/**
 * Step 1 (objective checks) and the measurable parts of step 4.
 *
 * Everything here reads the ENCODED mp4, not the preview -- banding and
 * lifted blacks are properties of the encode, and checking the preview would
 * miss both.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BIN = "node_modules/@remotion/compositor-linux-x64-gnu";
const FFMPEG = path.resolve(BIN, "ffmpeg");
const FFPROBE = path.resolve(BIN, "ffprobe");

const dir = process.argv[2] ?? "out/video";
const SAMPLE_FRAMES = [0, 150, 300, 450, 599];

const probe = (file) => {
  const out = execFileSync(FFPROBE, [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
    "-show_entries", "format=duration",
    "-of", "json", file,
  ]).toString();
  return JSON.parse(out);
};

/** One frame as raw RGB. Decoding to rawvideo avoids needing a PNG reader. */
const frameRGB = (file, frame, width, height) => {
  const buf = execFileSync(FFMPEG, [
    "-v", "error",
    "-i", file,
    "-vf", `select=eq(n\\,${frame})`,
    "-vsync", "0", "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ], { maxBuffer: 1024 * 1024 * 256 });
  return { buf, width, height };
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
  const duration = +Number(info.format.duration).toFixed(2);

  const frames = SAMPLE_FRAMES.map((f) => frameRGB(file, f, v.width, v.height));
  const perFrame = frames.map(stats);
  const deltas = frames.slice(1).map((f, i) => frameDelta(frames[i], f));

  const row = {
    file: name,
    resolution: `${v.width}x${v.height}`,
    fps: v.r_frame_rate,
    duration,
    codec: v.codec_name,
    pixFmt: v.pix_fmt,
    hasAudio,
    // Step 1 pass/fail
    ok:
      v.width === 1920 && v.height === 1080 &&
      v.r_frame_rate === "30/1" && Math.abs(duration - 20) < 0.05 &&
      v.codec_name === "h264" && v.pix_fmt === "yuv420p" && !hasAudio,
    medianLuminance: perFrame.map((s) => s.median),
    p05: perFrame.map((s) => s.p05),
    p95: perFrame.map((s) => s.p95),
    blownFraction: perFrame.map((s) => s.blownFraction),
    cornerMax: cornerMax(frames[2]),
    longestPlateau: frames.map(longestPlateau),
    frameDeltas: deltas,
  };
  report.push(row);

  console.log(
    `${name.padEnd(28)} ${row.ok ? "PASS" : "FAIL"}  ${row.resolution} ${row.fps} ${duration}s ` +
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
