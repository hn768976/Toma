#!/usr/bin/env node
// Step 5 (motion): take 2 s around a frame of an encoded preview, measure
// the frame-to-frame change on the disc (mean absolute luma difference) and
// in a static star-field patch. Smooth motion = an even series with no
// spikes; shimmer = large high-frequency change where the image should be
// moving slowly. Also writes a strip of crops for inspection.
//   --file=out/previews/Planet_Mars_Spin.mp4 --center=300 [--box=x,y,w,h]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { args } from "./common.mjs";

const file = args.file, center = Number(args.center ?? 300), half = 30;
const dir = file.replace(/\.mp4$/, "_motion");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `select=between(n\\,${center - half}\\,${center + half})`, "-vsync", "0", path.join(dir, "f_%03d.png")]);
const frames = fs.readdirSync(dir).filter((f) => f.startsWith("f_")).sort();
const [bx, by, bw, bh] = (args.box ?? "440,160,400,400").split(",").map(Number);
const lumaOf = async (f) => {
  const { data } = await sharp(path.join(dir, f)).extract({ left: bx, top: by, width: bw, height: bh }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const l = new Float32Array(bw * bh);
  for (let i = 0; i < l.length; i++) l[i] = 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2];
  return l;
};
const diffs = [];
let prev = await lumaOf(frames[0]);
for (let k = 1; k < frames.length; k++) {
  const cur = await lumaOf(frames[k]);
  let s = 0;
  for (let i = 0; i < cur.length; i++) s += Math.abs(cur[i] - prev[i]);
  diffs.push(s / cur.length);
  prev = cur;
}
const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / diffs.length);
const maxRatio = Math.max(...diffs) / mean;
console.log(`${path.basename(file)} frames ${center - half}..${center + half}, box ${bx},${by} ${bw}x${bh}`);
console.log("frame-to-frame mean |dL|:", diffs.map((d) => d.toFixed(2)).join(" "));
console.log(`mean ${mean.toFixed(3)}, sd ${sd.toFixed(3)} (cv ${(sd / mean).toFixed(3)}), max/mean ${maxRatio.toFixed(2)}`);
// Strip: 6 crops, 6 frames apart.
const picks = [0, 6, 12, 18, 24, 30].map((k) => frames[Math.min(frames.length - 1, half - 15 + k)]);
const tiles = await Promise.all(picks.map((f) => sharp(path.join(dir, f)).extract({ left: bx, top: by, width: bw, height: bh }).png().toBuffer()));
await sharp({ create: { width: bw * 6, height: bh, channels: 3, background: "#000" } })
  .composite(tiles.map((t, i) => ({ input: t, left: i * bw, top: 0 }))).png().toFile(path.join(dir, "strip.png"));
console.log(`strip: ${path.join(dir, "strip.png")}`);
