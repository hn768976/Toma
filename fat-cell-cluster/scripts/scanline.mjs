/**
 * Banding check on an encoded frame.
 *
 * Walks one horizontal and one vertical scanline and reports the longest runs
 * of a single value. A smooth gradient dithered at +/-1/255 produces short
 * runs; stepped plateaus — long runs of one value with abrupt jumps between
 * them — are banding.
 *
 *   npx remotion ffmpeg -y -ss 5 -i out/preview/X.mp4 -frames:v 1 /tmp/band.png
 *   node scripts/scanline.mjs /tmp/band.png
 */

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const decodePng = (path) => {
  const d = readFileSync(path);
  let pos = 8, idat = [], w = 0, h = 0, colorType = 2;
  while (pos < d.length) {
    const len = d.readUInt32BE(pos);
    const type = d.toString("ascii", pos + 4, pos + 8);
    if (type === "IHDR") {
      w = d.readUInt32BE(pos + 8);
      h = d.readUInt32BE(pos + 12);
      colorType = d[pos + 17];
    } else if (type === "IDAT") {
      idat.push(d.subarray(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride), i = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[i++];
    const line = Buffer.from(raw.subarray(i, i + stride));
    i += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      if (filter === 1) line[x] = (line[x] + a) & 255;
      else if (filter === 2) line[x] = (line[x] + b) & 255;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return { w, h, bpp, data: out };
};

const report = (label, values) => {
  // A run of identical values only means banding if the value is inside the
  // representable range. A clipped highlight is flat because it is clipped,
  // which is an exposure problem, not a quantisation one, and counting it as
  // banding sends you chasing grain that cannot help.
  let longest = 1, run = 1, at = 0, steps = 0, clipped = 0;
  for (let i = 1; i < values.length; i++) {
    const ch = channels(values[i]);
    if (ch.every((c) => c >= 253) || ch.every((c) => c <= 2)) clipped++;
    const flat = values[i] === values[i - 1];
    // Grain cannot dither a value with no headroom above it: half the samples
    // clamp, so a run at the top of the range is an exposure problem and not a
    // quantisation one.
    const inRange = !(ch.every((c) => c >= 253) || ch.every((c) => c <= 2));
    if (flat && inRange) {
      run++;
      if (run > longest) { longest = run; at = i - run + 1; }
    } else {
      if (run >= 12 && inRange) steps++;
      run = 1;
    }
  }
  const changes = values.reduce((n, v, i) => n + (i > 0 && v !== values[i - 1] ? 1 : 0), 0);
  const distinct = new Set(values).size;
  const verdict = longest >= 24 ? "BANDING" : longest >= 12 ? "marginal" : "clean";
  console.log(
    `${label.padEnd(12)} longest flat run ${String(longest).padStart(4)}px ` +
    `at ${String(at).padStart(4)}, plateaus>=12px: ${String(steps).padStart(3)}, ` +
    `distinct ${String(distinct).padStart(3)}, ` +
    `neighbour changes ${String(Math.round((100 * changes) / values.length)).padStart(3)}%, ` +
    `clipped ${String(Math.round((100 * clipped) / values.length)).padStart(3)}%  -> ${verdict}`,
  );
};

const path = process.argv[2];
if (!path) { console.error("usage: node scripts/scanline.mjs <frame.png>"); process.exit(1); }
const img = decodePng(path);
// Whole pixels, not one channel and not a luminance average. Reading red
// alone reports a well-exposed amber frame as a quarter clipped, because red
// saturates on a warm surface long before any detail is lost; rounding a
// luminance average invents plateaus of its own, since two pixels with
// different colours can share one rounded average. A step is only visible
// where all three channels hold still together.
const px = (x, y) => {
  const o = (y * img.w + x) * img.bpp;
  return (img.data[o] << 16) | (img.data[o + 1] << 8) | img.data[o + 2];
};
const channels = (v) => [(v >> 16) & 255, (v >> 8) & 255, v & 255];

const row = [], col = [];
// A scanline through the upper-left eighth, which is background on every look.
const y0 = Math.round(img.h * 0.12);
for (let x = 0; x < img.w; x++) row.push(px(x, y0));
const x0 = Math.round(img.w * 0.06);
for (let y = 0; y < img.h; y++) col.push(px(x0, y));

console.log(`${path}  ${img.w}x${img.h}`);
report("horizontal", row);
report("vertical", col);
