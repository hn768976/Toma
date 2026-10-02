#!/usr/bin/env node
/**
 * Checks for the rendered previews. Needs ffmpeg + ffprobe on PATH, no npm deps.
 *
 *   node scripts/verify.mjs probe   <file.mp4>                 step 1: format checks
 *   node scripts/verify.mjs black   <file.mp4>                 step 1: look 2 pure black
 *   node scripts/verify.mjs same    <a.png> <b.png>            steps 2/3: pixel-identical?
 *   node scripts/verify.mjs banding <file.mp4> <frame> <out.png>  step 4
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [, , cmd, ...args] = process.argv;
const run = (bin, a, opts = {}) => execFileSync(bin, a, { maxBuffer: 1 << 30, ...opts });

/** Decode one frame (of a video or an image) to an RGB24 buffer. */
const rgb = (file, frame = null) => {
  const sel = frame === null ? [] : ["-vf", `select=eq(n\\,${frame})`, "-vsync", "0"];
  const out = run("ffmpeg", ["-v", "error", "-i", file, ...sel, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  const [w, h] = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]).toString().trim().split(",").map(Number);
  return { w, h, px: out };
};

const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) process.exitCode = 1; };

if (cmd === "probe") {
  const file = args[0];
  const j = JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]).toString());
  const v = j.streams.filter((s) => s.codec_type === "video");
  const a = j.streams.filter((s) => s.codec_type === "audio");
  console.log(`${file}`);
  ok(v.length === 1, `one video stream`);
  ok(v[0].width === 1920 && v[0].height === 1080, `resolution ${v[0].width}x${v[0].height}`);
  ok(v[0].r_frame_rate === "30/1", `frame rate ${v[0].r_frame_rate}`);
  ok(Math.abs(Number(j.format.duration) - 20) < 0.001, `duration ${j.format.duration}s`);
  ok(v[0].codec_name === "h264", `codec ${v[0].codec_name}`);
  ok(v[0].pix_fmt === "yuv420p", `pixel format ${v[0].pix_fmt}`);
  ok(Number(v[0].nb_frames) === 600, `frame count ${v[0].nb_frames}`);
  ok(a.length === 0, `no audio stream (${a.length} found)`);
} else if (cmd === "black") {
  const file = args[0];
  // corners and edge strips, far from the atom, in several frames
  for (const f of [0, 150, 300, 450, 599]) {
    const { w, h, px } = rgb(file, f);
    let max = 0, n = 0;
    const regions = [[0, 0, 300, 200], [w - 300, 0, w, 200], [0, h - 200, 300, h], [w - 300, h - 200, w, h], [0, 400, 150, 680], [w - 150, 400, w, 680]];
    for (const [x0, y0, x1, y1] of regions)
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 3;
        max = Math.max(max, px[i], px[i + 1], px[i + 2]);
        n++;
      }
    ok(max === 0, `frame ${f}: ${n} empty-area pixels, max channel value ${max} (want 0,0,0)`);
  }
} else if (cmd === "same") {
  const A = rgb(args[0]), B = rgb(args[1]);
  let diff = 0, maxd = 0;
  for (let i = 0; i < A.px.length; i++) { const d = Math.abs(A.px[i] - B.px[i]); if (d) { diff++; maxd = Math.max(maxd, d); } }
  const bytes = readFileSync(args[0]).equals(readFileSync(args[1]));
  ok(A.w === B.w && A.h === B.h && diff === 0, `${args[0]} vs ${args[1]}: ${diff} differing channel values (max ${maxd}); files byte-identical: ${bytes}`);
} else if (cmd === "banding") {
  const [file, frame, out] = args;
  run("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", `select=eq(n\\,${frame})`, "-vsync", "0", "-frames:v", "1", out]);
  const { w, h, px } = rgb(out);
  // lines through the nebula, away from the atom
  for (const [name, y] of [["y=12%", Math.round(h * 0.12)], ["y=85%", Math.round(h * 0.85)]]) {
    const L = [];
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; L.push(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]); }
    // 1) longest run of one identical raw value in the gradient's dominant channel
    //    (a band shows as a long flat run). Runs at 0 are clipped black, not bands.
    const sums = [0, 1, 2].map((c) => { let t = 0; for (let x = 0; x < w; x++) t += px[(y * w + x) * 3 + c]; return t; });
    const ch = sums.indexOf(Math.max(...sums));
    const G = [];
    for (let x = 0; x < w; x++) G.push(px[(y * w + x) * 3 + ch]);
    let run1 = 1, best = 1;
    for (let x = 1; x < w; x++) { run1 = G[x] === G[x - 1] && G[x] !== 0 ? run1 + 1 : 1; best = Math.max(best, run1); }
    // 2) smoothed profile (box 41), printed for reading the ramp by eye. Its slope is
    //    NOT a pass/fail signal: real nebula structure and bokeh edges are steep.
    const S = L.map((_, x) => { let s = 0, c = 0; for (let k = -20; k <= 20; k++) { const j = x + k; if (j >= 0 && j < w) { s += L[j]; c++; } } return s / c; });
    let maxStep = 0;
    for (let x = 1; x < w; x++) maxStep = Math.max(maxStep, Math.abs(S[x] - S[x - 1]));
    const sample = S.filter((_, x) => x % 160 === 0).map((v) => v.toFixed(1)).join(" ");
    console.log(`  ${name}: smoothed luma every 160px: ${sample}`);
    ok(best <= 12, `${name}: channel ${"RGB"[ch]} longest flat run of one value ${best}px (want ≤12; banding shows as long plateaus). Max smoothed slope ${maxStep.toFixed(2)} levels/px (info)`);
  }
} else {
  console.log("usage: verify.mjs probe|black|same|banding …");
  process.exitCode = 2;
}
