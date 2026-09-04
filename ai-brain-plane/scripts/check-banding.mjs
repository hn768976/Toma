/**
 * Looks for banding in the dark falloff of an ENCODED frame.
 *
 * H.264 at 8 bits is where banding actually shows up, so this is meant to be
 * run on a PNG extracted from the mp4, not on the render straight out of
 * Chromium. It walks columns through the darkest part of the frame and counts
 * how long each run of one identical luma value is: a smooth, dithered
 * gradient breaks into short runs, a banded one holds a value for many rows.
 *
 *   node scripts/check-banding.mjs frame.png
 */
import { readPng } from "./png.mjs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/check-banding.mjs <frame.png>");
  process.exit(2);
}
const { width, height, channels, pixels } = readPng(path);
const luma = (x, y) => {
  const i = (y * width + x) * channels;
  return Math.round(0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]);
};

// The falloff into darkness lives in the top half of the frame.
const yTop = 0;
const yBottom = Math.floor(height * 0.5);
let longest = 0;
let longestAt = null;
const runs = [];
for (let x = 0; x < width; x += 7) {
  let run = 1;
  for (let y = yTop + 1; y < yBottom; y++) {
    const v = luma(x, y);
    // Only the ramp itself is interesting. Fully black sky and anything past
    // the toe are legitimately flat and say nothing about banding.
    if (v > 60 || v <= 3) {
      run = 1;
      continue;
    }
    if (v === luma(x, y - 1)) {
      run++;
    } else {
      if (run > 1) runs.push(run);
      if (run > longest) {
        longest = run;
        longestAt = [x, y];
      }
      run = 1;
    }
  }
}
runs.sort((a, b) => b - a);
const p99 = runs[Math.floor(runs.length * 0.01)] ?? 0;
console.log(`${path}  ${width}x${height}`);
console.log(`  longest constant-luma run in the dark falloff: ${longest} rows${longestAt ? ` at x=${longestAt[0]}` : ""}`);
console.log(`  99th percentile run length: ${p99} rows`);
// A visible band means a flat plateau tens of rows deep. Dithered gradients
// stay well under that even when the ramp is very shallow.
if (longest > 60) {
  console.error("FAIL: flat plateaus this deep will read as banding.");
  process.exit(1);
}
console.log("OK: no plateau long enough to read as a band.");
