// Verify-loop step 4: banding check on the ENCODED mp4 (not the preview).
//
// Usage:
//   node scripts/verify/banding-check.mjs <video.mp4> <frame> <x,y,w,h> [<x,y,w,h> ...]
//
// Extracts <frame> from the H.264 file with ffmpeg (saved as a PNG next to
// the video), then for each rectangle reports, on 8-bit luma:
//   - codes filled: share of the code values between the 1st and 99th
//     percentile that actually occur. Banding leaves gaps (whole codes
//     missing across a smooth area); dither + grain fill them.
//   - max / mean run: longest and average run of identical values along the
//     rows. Bands show up as long flat runs that end in a 1-code jump.
//   - profile: the rectangle averaged into 16 columns (grain averages out);
//     a smooth falloff changes gradually, a banded one in visible steps.
// A region passes with codes filled >= 0.95 and max run <= 24 px.
import { execFileSync } from "node:child_process";
import path from "node:path";

const [video, frameArg, ...rects] = process.argv.slice(2);
if (!video || !frameArg || rects.length === 0) {
  console.error("usage: banding-check.mjs <video.mp4> <frame> <x,y,w,h> [...]");
  process.exit(2);
}
const frame = Number(frameArg);
const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", video])
  .toString()
  .trim()
  .split(",")
  .map(Number);
const [W, H] = probe;
const png = path.join(path.dirname(video), `${path.basename(video, ".mp4")}_banding_f${frame}.png`);
const select = ["-vf", `select=eq(n\\,${frame})`, "-vsync", "0", "-frames:v", "1"];
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", video, ...select, png]);
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", png, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: W * H * 3 + 1024 });

const luma = (x, y) => {
  const o = (y * W + x) * 3;
  return Math.round(0.2126 * raw[o] + 0.7152 * raw[o + 1] + 0.0722 * raw[o + 2]);
};

let allPass = true;
console.log(`${path.basename(video)} frame ${frame} -> ${path.basename(png)} (${W}x${H})`);
for (const r of rects) {
  const [x0, y0, w, h] = r.split(",").map(Number);
  const vals = [];
  let maxRun = 0;
  let runs = 0;
  let runTotal = 0;
  for (let y = y0; y < y0 + h; y++) {
    let prev = -1;
    let run = 0;
    for (let x = x0; x < x0 + w; x++) {
      const v = luma(x, y);
      vals.push(v);
      if (v === prev) run++;
      else {
        if (run) {
          maxRun = Math.max(maxRun, run);
          runs++;
          runTotal += run;
        }
        run = 1;
        prev = v;
      }
    }
    maxRun = Math.max(maxRun, run);
    runs++;
    runTotal += run;
  }
  const sorted = [...vals].sort((a, b) => a - b);
  const p1 = sorted[Math.floor(sorted.length * 0.01)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const present = new Set(vals.filter((v) => v >= p1 && v <= p99));
  const filled = present.size / (p99 - p1 + 1);
  const cols = 16;
  const profile = [];
  for (let c = 0; c < cols; c++) {
    let s = 0;
    let n = 0;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0 + Math.floor((c * w) / cols); x < x0 + Math.floor(((c + 1) * w) / cols); x++) {
        s += luma(x, y);
        n++;
      }
    }
    profile.push(s / n);
  }
  const pass = filled >= 0.95 && maxRun <= 24;
  allPass &&= pass;
  console.log(
    `  [${r}] luma ${p1}-${p99}  codes filled ${(filled * 100).toFixed(0)}%  max run ${maxRun}px  mean run ${(runTotal / runs).toFixed(2)}px  ${pass ? "PASS" : "FAIL"}`,
  );
  console.log(`      profile: ${profile.map((v) => v.toFixed(1)).join(" ")}`);
}
process.exit(allPass ? 0 : 1);
