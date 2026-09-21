/**
 * Step 1 (objective checks) and the measurable parts of step 4.
 *
 * Everything here reads the ENCODED mp4, not the preview -- banding and
 * lifted blacks are properties of the encode, and checking the preview would
 * miss both.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import path from "node:path";

const BIN = "node_modules/@remotion/compositor-linux-x64-gnu";
const FFMPEG = path.resolve(BIN, "ffmpeg");
const FFPROBE = path.resolve(BIN, "ffprobe");

const dir = process.argv[2] ?? "out/video";
const SAMPLE_FRAMES = [0, 150, 300, 450, 599];

const probe = (file) => {
  const out = execFileSync(FFPROBE, [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,duration,nb_frames",
    "-show_entries", "format=duration",
    "-of", "json", file,
  ]).toString();
  return JSON.parse(out);
};

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/**
 * Minimal PNG reader: 8-bit, non-interlaced, RGB or RGBA -- what ffmpeg's png
 * encoder produces here. Remotion's ffmpeg build has the rawvideo muxer
 * compiled out, so frames come back as PNG and are decoded in place rather
 * than pulling in an image library for four functions.
 */
const decodePNG = (buf) => {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error(`unsupported bit depth ${data[8]}`);
      colorType = data[9];
      if (data[12] !== 0) throw new Error("interlaced PNG not supported");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`unsupported colour type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 3);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 0xff;
      else if (filter === 2) line[i] = (line[i] + b) & 0xff;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) line[i] = (line[i] + paeth(a, b, c)) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      out[(y * width + x) * 3] = line[x * channels];
      out[(y * width + x) * 3 + 1] = line[x * channels + 1];
      out[(y * width + x) * 3 + 2] = line[x * channels + 2];
    }
    prev = line;
  }

  return { buf: out, width, height };
};

/**
 * One frame of the encoded file, as 8-bit RGB.
 *
 * Seeks with `-ss` AFTER `-i`, which decodes from the start and is therefore
 * frame-accurate; this ffmpeg build also has the `select` filter compiled
 * out, so picking a frame by index is not available.
 */
const frameRGB = (file, frame, width, height, fps) => {
  const png = execFileSync(FFMPEG, [
    "-v", "error",
    "-i", file,
    // A quarter of a frame BEFORE the target presentation time. Seeking to
    // the exact PTS risks landing a float hair past it, which selects the
    // next frame -- or nothing at all on the last frame of the clip.
    "-ss", Math.max(0, (frame - 0.25) / fps).toFixed(6),
    "-frames:v", "1",
    "-f", "image2pipe", "-vcodec", "png", "-",
  ], { maxBuffer: 1024 * 1024 * 512 });

  const img = decodePNG(png);
  if (img.width !== width || img.height !== height) {
    throw new Error(
      `frame ${frame} of ${path.basename(file)}: got ${img.width}x${img.height}, expected ${width}x${height}`,
    );
  }
  return img;
};

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const stats = ({ buf, width, height }) => {
  const n = width * height;
  const lums = new Float32Array(n);
  let blown = 0;
  for (let i = 0; i < n; i++) {
    const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
    lums[i] = lum(r, g, b);
    if (r >= 250 && g >= 250 && b >= 250) blown++;
  }
  const sorted = Float32Array.from(lums).sort();
  const pct = (p) => sorted[Math.min(n - 1, Math.floor(p * n))];
  return {
    median: +pct(0.5).toFixed(4),
    p05: +pct(0.05).toFixed(4),
    p95: +pct(0.95).toFixed(4),
    blownFraction: +(blown / n).toFixed(5),
  };
};

/** Darkest pixel in a corner block -- look 6 must encode true black. */
const cornerMax = ({ buf, width, height }, block = 24) => {
  let worst = 0;
  const corners = [[0, 0], [width - block, 0], [0, height - block], [width - block, height - block]];
  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + block; y++) {
      for (let x = cx; x < cx + block; x++) {
        const i = (y * width + x) * 3;
        worst = Math.max(worst, buf[i], buf[i + 1], buf[i + 2]);
      }
    }
  }
  return worst;
};

/**
 * Longest run of an identical code value along a scanline. Stepped plateaus
 * in what should be a smooth gradient are what banding looks like.
 */
const longestPlateau = ({ buf, width, height }) => {
  let worst = 0;
  const rows = [Math.floor(height * 0.12), Math.floor(height * 0.5), Math.floor(height * 0.88)];
  for (const y of rows) {
    let run = 1;
    for (let x = 1; x < width; x++) {
      const a = (y * width + x) * 3;
      const b = (y * width + x - 1) * 3;
      const same = buf[a] === buf[b] && buf[a + 1] === buf[b + 1] && buf[a + 2] === buf[b + 2];
      run = same ? run + 1 : 1;
      if (run > worst) worst = run;
    }
  }
  // Vertical scanlines too: banding often runs one way only.
  const cols = [Math.floor(width * 0.12), Math.floor(width * 0.5), Math.floor(width * 0.88)];
  for (const x of cols) {
    let run = 1;
    for (let y = 1; y < height; y++) {
      const a = (y * width + x) * 3;
      const b = ((y - 1) * width + x) * 3;
      const same = buf[a] === buf[b] && buf[a + 1] === buf[b + 1] && buf[a + 2] === buf[b + 2];
      run = same ? run + 1 : 1;
      if (run > worst) worst = run;
    }
  }
  return worst;
};

/** Mean absolute difference between two frames, 0..1. */
const frameDelta = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.buf.length; i++) sum += Math.abs(a.buf[i] - b.buf[i]);
  return +(sum / a.buf.length / 255).toFixed(5);
};

const files = readdirSync(dir).filter((f) => f.endsWith(".mp4")).sort();
if (files.length === 0) {
  console.error(`no mp4 files in ${dir}`);
  process.exit(1);
}

const report = [];
for (const name of files) {
  const file = path.join(dir, name);
  const info = probe(file);
  const v = info.streams.find((s) => s.codec_type === "video");
  const hasAudio = info.streams.some((s) => s.codec_type === "audio");
  // The VIDEO STREAM's duration and frame count are the delivery facts.
  // Container duration carries muxing overhead and reads a little long even
  // when the stream holds exactly 600 frames at 30fps.
  const duration = +Number(v.duration).toFixed(3);
  const containerDuration = +Number(info.format.duration).toFixed(3);
  const frames600 = Number(v.nb_frames);

  // Clamp to what the file actually contains, so a short or partial render
  // reports a real failure rather than throwing inside the decoder.
  const [rateNum, rateDen] = v.r_frame_rate.split("/").map(Number);
  const fps = rateNum / (rateDen || 1);
  const frameCount = Math.round(duration * fps);
  const sample = SAMPLE_FRAMES.filter((f) => f < frameCount);
  const frames = sample.map((f) => frameRGB(file, f, v.width, v.height, fps));
  const perFrame = frames.map(stats);
  const deltas = frames.slice(1).map((f, i) => frameDelta(frames[i], f));

  const row = {
    file: name,
    resolution: `${v.width}x${v.height}`,
    fps: v.r_frame_rate,
    duration,
    containerDuration,
    frameCount: frames600,
    codec: v.codec_name,
    pixFmt: v.pix_fmt,
    hasAudio,
    // Step 1 pass/fail
    ok:
      v.width === 1920 && v.height === 1080 &&
      v.r_frame_rate === "30/1" && Math.abs(duration - 20) < 0.01 &&
      frames600 === 600 &&
      v.codec_name === "h264" && v.pix_fmt === "yuv420p" && !hasAudio,
    medianLuminance: perFrame.map((s) => s.median),
    p05: perFrame.map((s) => s.p05),
    p95: perFrame.map((s) => s.p95),
    blownFraction: perFrame.map((s) => s.blownFraction),
    // Mid-clip frame where available, so the corners are sampled with the
    // structure fully lit rather than at a quiet point in the loop.
    cornerMax: cornerMax(frames[Math.min(2, frames.length - 1)]),
    sampledFrames: sample,
    longestPlateau: frames.map(longestPlateau),
    frameDeltas: deltas,
  };
  report.push(row);

  console.log(
    `${name.padEnd(28)} ${row.ok ? "PASS" : "FAIL"}  ${row.resolution} ${row.fps} ${duration}s ${frames600}f ` +
    `${row.codec}/${row.pixFmt} audio=${hasAudio}\n` +
    `    medianLum=${row.medianLuminance.join(",")}\n` +
    `    blown=${row.blownFraction.join(",")}  cornerMax=${row.cornerMax}  ` +
    `maxPlateau=${Math.max(...row.longestPlateau)}px  frameDeltas=${deltas.join(",")}`,
  );
}

writeFileSync("out/verify-output.json", JSON.stringify(report, null, 2));
const bad = report.filter((r) => !r.ok);
console.log(`\n${report.length - bad.length}/${report.length} pass step 1`);
if (bad.length) console.log("failing:", bad.map((b) => b.file).join(", "));
