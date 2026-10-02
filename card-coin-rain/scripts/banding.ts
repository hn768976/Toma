/**
 * Banding check on the ENCODED video (not the preview).
 * Extracts one frame from the mp4 as PNG, then reads pixel values along a
 * horizontal and a vertical line through the backdrop.
 *
 * A banded gradient shows up as flat plateaus (a 64-px window holding only
 * one or two code values) separated by 1-level jumps in the smoothed profile.
 * A dithered/grained one has many code values per window and a smoothed
 * profile that moves by fractions of a level.
 *
 *   npx tsx scripts/banding.ts out/CardRain_Gold.mp4 150 [row] [col]
 */
import { execFileSync } from "node:child_process";

const [video, frameArg, rowArg, colArg] = process.argv.slice(2);
const frame = Number(frameArg ?? 150);
const W = 1920;
const H = 1080;
const png = video.replace(/\.mp4$/, `_banding_f${frame}.png`);

execFileSync("ffmpeg", ["-v", "error", "-y", "-i", video, "-vf", `select=eq(n\\,${frame})`, "-frames:v", "1", png]);
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", png, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], {
  maxBuffer: W * H * 3 + 1024,
});
const px = (x: number, y: number) => {
  const o = (y * W + x) * 3;
  return [raw[o], raw[o + 1], raw[o + 2]];
};
const luma = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

const analyse = (label: string, values: number[][]) => {
  const L = values.map(luma);
  const win = 64;
  const uniq: number[] = [];
  for (let i = 0; i + win <= values.length; i += win) {
    const set = new Set(values.slice(i, i + win).map((c) => c[1]));
    uniq.push(set.size);
  }
  // smoothed profile (box 31) and its largest step between neighbours
  const r = 15;
  const sm: number[] = [];
  for (let i = r; i < L.length - r; i++) {
    let s = 0;
    for (let j = -r; j <= r; j++) s += L[i + j];
    sm.push(s / (2 * r + 1));
  }
  let maxStep = 0;
  for (let i = 1; i < sm.length; i++) maxStep = Math.max(maxStep, Math.abs(sm[i] - sm[i - 1]));
  // plateau test: a 64-px window with <= 2 distinct green values = banding
  const plateaus = uniq.filter((u) => u <= 2).length;
  console.log(`\n${label}`);
  console.log(
    "  RGB every 128 px:",
    values.filter((_, i) => i % 128 === 0).map((c) => `(${c.join(",")})`).join(" "),
  );
  console.log("  smoothed luma every 64 px:", sm.filter((_, i) => i % 64 === 0).map((v) => v.toFixed(2)).join(" "));
  console.log(`  distinct G values per 64-px window: min ${Math.min(...uniq)}, median ${uniq.sort((a, b) => a - b)[uniq.length >> 1]}`);
  console.log(`  largest px-to-px step in smoothed profile: ${maxStep.toFixed(3)} levels (object edges included)`);
  console.log(`  flat 1-2 value plateaus: ${plateaus} -> ${plateaus === 0 ? "SMOOTH (no banding)" : "CHECK: possible banding"}`);
  return plateaus === 0;
};

const row = Number(rowArg ?? 40);
const col = Number(colArg ?? 60);
const okRow = analyse(`row y=${row}`, Array.from({ length: W }, (_, x) => px(x, row)));
const okCol = analyse(`column x=${col}`, Array.from({ length: H }, (_, y) => px(col, y)));
console.log(`\nframe PNG: ${png}`);
process.exit(okRow && okCol ? 0 : 1);
