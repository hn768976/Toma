/**
 * Look 1A's whole-cell activation: the cell must brighten and fade exactly
 * TWICE over the loop.
 *
 * The five frames the general checks sample (0/150/300/450/599) all land on
 * the same phase of a two-cycle sine, so they show a flat curve however well
 * the pulse is working. This samples across the loop instead and counts the
 * maxima.
 *
 *   node scripts/verify-pulse.mjs out/video/HeroNeuron_Matted.mp4 [samples]
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { inflateSync } from "node:zlib";

const FFMPEG = path.resolve("node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg");
const file = process.argv[2];
const samples = Number(process.argv[3] ?? 16);
const fps = 30;
const loop = 600;

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

const decode = (png) => {
  let pos = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (pos + 8 <= png.length) {
    const len = png.readUInt32BE(pos);
    const t = png.toString("ascii", pos + 4, pos + 8);
    const d = png.subarray(pos + 8, pos + 8 + len);
    if (t === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    else if (t === "IDAT") idat.push(d);
    else if (t === "IEND") break;
    pos += 12 + len;
  }
  const ch = ct === 6 ? 4 : 3, stride = w * ch;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 3);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      if (f === 1) line[i] = (line[i] + a) & 255;
      else if (f === 2) line[i] = (line[i] + b) & 255;
      else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (f === 4) line[i] = (line[i] + paeth(a, b, c)) & 255;
    }
    for (let x = 0; x < w; x++) {
      px[(y * w + x) * 3] = line[x * ch];
      px[(y * w + x) * 3 + 1] = line[x * ch + 1];
      px[(y * w + x) * 3 + 2] = line[x * ch + 2];
    }
    prev = line;
  }
  return { px, w, h };
};

/** Mean luminance of the brightest 2% of pixels -- effectively the soma. */
const somaBrightness = ({ px, w, h }) => {
  const n = w * h;
  const lums = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    lums[i] = (0.2126 * px[i * 3] + 0.7152 * px[i * 3 + 1] + 0.0722 * px[i * 3 + 2]) / 255;
  }
  const sorted = Float32Array.from(lums).sort();
  const cut = Math.floor(n * 0.98);
  let sum = 0;
  for (let i = cut; i < n; i++) sum += sorted[i];
  return sum / (n - cut);
};

const curve = [];
for (let s = 0; s < samples; s++) {
  const frame = Math.round((s / samples) * loop);
  const png = execFileSync(FFMPEG, [
    "-v", "error", "-i", file,
    "-ss", Math.max(0, (frame - 0.25) / fps).toFixed(6),
    "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-",
  ], { maxBuffer: 1 << 29 });
  const value = somaBrightness(decode(png));
  curve.push({ frame, value: +value.toFixed(5) });
  console.log(`frame ${String(frame).padStart(3)}  ${value.toFixed(5)}`);
}

// Count local maxima on the circular curve.
const v = curve.map((c) => c.value);
const peaks = [];
for (let i = 0; i < v.length; i++) {
  const prev = v[(i - 1 + v.length) % v.length];
  const next = v[(i + 1) % v.length];
  if (v[i] > prev && v[i] >= next) peaks.push(curve[i].frame);
}
const min = Math.min(...v), max = Math.max(...v);
console.log(`\nmaxima at frames: ${peaks.join(", ")}  (count ${peaks.length})`);
console.log(`range ${min.toFixed(5)} .. ${max.toFixed(5)}  (${((max / min - 1) * 100).toFixed(1)}% brighter at peak)`);
