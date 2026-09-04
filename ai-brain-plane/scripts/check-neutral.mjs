/**
 * Asserts that a rendered V2 frame carries no hue at all: every pixel must
 * have R === G === B. Run it on a PNG still, or on a frame pulled out of the
 * encoded mp4, whenever the mono palette is touched.
 *
 *   node scripts/check-neutral.mjs out/V2_AIBrainPlaneMono.png
 */
import { readPng } from "./png.mjs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/check-neutral.mjs <frame.png>");
  process.exit(2);
}

const { width, height, channels, pixels } = readPng(path);
let worst = 0;
let worstPixel = null;
let sum = [0, 0, 0];
for (let i = 0; i < width * height * channels; i += channels) {
  const r = pixels[i];
  const g = pixels[i + 1];
  const b = pixels[i + 2];
  sum[0] += r;
  sum[1] += g;
  sum[2] += b;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread > worst) {
    worst = spread;
    worstPixel = [r, g, b];
  }
}
const n = width * height;
console.log(`${path}  ${width}x${height}`);
console.log(
  `  channel means  R ${(sum[0] / n).toFixed(3)}  G ${(sum[1] / n).toFixed(3)}  B ${(sum[2] / n).toFixed(3)}`,
);
console.log(`  worst per-pixel channel spread: ${worst}${worstPixel ? ` at rgb(${worstPixel})` : ""}`);
if (worst > 0) {
  console.error("FAIL: the mono version still carries a hue.");
  process.exit(1);
}
console.log("OK: genuinely neutral, no residual blue.");
