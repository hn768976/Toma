#!/usr/bin/env node
// Step 4: pull a frame out of the ENCODED mp4 and read pixel values along a
// line through the disc centre: across the terminator and across the
// atmosphere rim into space. Reports the profile, the longest run of equal
// values and the largest step inside the gradients, and the black level of
// empty space.
//   --file=out/previews/Planet_Mars_Spin.mp4 --frame=300 --y=360 [--x0 --x1]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
import { args } from "./common.mjs";

const file = args.file, frame = Number(args.frame ?? 300);
const png = args.png ?? file.replace(/\.mp4$/, `_f${frame}.png`);
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", `select=eq(n\\,${frame})`, "-vsync", "0", "-frames:v", "1", png]);
const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const y = Number(args.y ?? Math.round(H / 2));
const x0 = Number(args.x0 ?? 0), x1 = Number(args.x1 ?? W - 1);
const lum = [];
for (let x = x0; x <= x1; x++) {
  const i = (y * W + x) * 3;
  lum.push(Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]));
}
// Gradient regions: where a 9-px window spans > 6 levels (terminator, rim).
let worstStep = 0, longestFlat = 0, run = 1;
for (let k = 1; k < lum.length; k++) {
  const win = lum.slice(Math.max(0, k - 4), k + 5);
  const inGrad = Math.max(...win) - Math.min(...win) > 6 && Math.min(...win) > 3;
  const step = Math.abs(lum[k] - lum[k - 1]);
  if (inGrad) worstStep = Math.max(worstStep, step);
  if (inGrad && lum[k] === lum[k - 1]) { run++; longestFlat = Math.max(longestFlat, run); } else run = 1;
}
// Space black level: corners of the frame.
let maxBlack = 0, sumBlack = 0, n = 0;
for (const [cx, cy] of [[8, 8], [W - 72, 8], [8, H - 72], [W - 72, H - 72]])
  for (let yy = cy; yy < cy + 64; yy++) for (let xx = cx; xx < cx + 64; xx++) {
    const i = (yy * W + xx) * 3;
    const v = Math.max(data[i], data[i + 1], data[i + 2]);
    sumBlack += v; n++;
    // ignore stars (isolated bright points)
    if (v < 40) maxBlack = Math.max(maxBlack, v);
  }
fs.writeFileSync(png.replace(/\.png$/, "_profile.json"), JSON.stringify({ y, x0, x1, lum }));
console.log(`frame ${frame} of ${file} (${W}x${H}), row ${y}, x ${x0}..${x1}`);
const fmt = (a) => a.map((v) => String(v).padStart(3)).join("");
for (let k = 0; k < lum.length; k += 40) console.log(String(x0 + k).padStart(5), fmt(lum.slice(k, k + 40)));
console.log(`largest step inside gradients: ${worstStep} levels; longest flat run inside gradients: ${longestFlat} px`);
console.log(`space corners (non-star pixels): max ${maxBlack}, mean ${(sumBlack / n).toFixed(2)}`);
