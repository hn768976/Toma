// Banding check on the ENCODED mp4 (not the preview): decode one frame and
// read pixel values across the beam falloff and across the dark board.
//   node scripts/banding-check.mjs out/previews/NeonIcon_AIChat.mp4 [frame]
// Reports, per region: the grain-free (box-averaged) profile, raw pixel
// values, staircase steps (flat run → ≥0.75-level jump → flat run) and
// missing 8-bit codes inside shallow gradients (posterisation = banding).
import { execFileSync } from 'node:child_process';

const file = process.argv[2];
const frame = Number(process.argv[3] ?? 150);
const probe = execFileSync('npx', ['remotion', 'ffprobe', '-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim().split(',');
const W = Number(probe[0]);
const H = Number(probe[1]);
// (Remotion's bundled ffmpeg has no select filter / rawvideo muxer: seek + image2pipe)
const ss = Math.max(0, (frame - 0.25) / 30).toFixed(4);
const raw = execFileSync('npx', ['remotion', 'ffmpeg', '-v', 'error', '-ss', ss, '-i', file,
  '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
  { maxBuffer: 1 << 28 });
const px = (x, y, c) => raw[(y * W + x) * 3 + c];
const lum = (x, y) => 0.2126 * px(x, y, 0) + 0.7152 * px(x, y, 1) + 0.0722 * px(x, y, 2);

// locate the beam: brightest blue column band in the top 12% of the frame
let bestX = 0, best = -1;
for (let x = 0; x < W; x += 2) {
  let s = 0;
  for (let y = 0; y < Math.round(H * 0.12); y += 2) s += px(x, y, 2) - 0.5 * px(x, y, 0);
  if (s > best) { best = s; bestX = x; }
}
const beamRow = Math.round(H * 0.06);

const region = (name, pts, chan) => {
  const R = Math.round(H / 270); // box radius: 4 px at 1080p (averages the grain away)
  const clampXY = (x, y) => [Math.min(W - 1, Math.max(0, x)), Math.min(H - 1, Math.max(0, y))];
  const box = (x, y, fn) => { for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) fn(...clampXY(x + dx, y + dy)); };
  const avg = pts.map(([x, y]) => { let s = 0, n = 0; box(x, y, (xx, yy) => { s += chan(xx, yy); n++; }); return s / n; });
  // 1) staircase detector on a cross-line average (keeps step edges sharp along
  //    the line): a jump of >= 0.75 level between two flat runs of 8 px
  const col = pts.map(([x, y]) => { let s = 0; for (let d = -R; d <= R; d++) { const [xx, yy] = clampXY(x, y + d); s += chan(xx, yy); } return s / (2 * R + 1); });
  const flat = (a, b) => { const v = col.slice(Math.max(0, a), Math.min(col.length, b)); return Math.max(...v) - Math.min(...v) < 0.35; };
  let steps = 0;
  for (let i = 8; i < col.length - 9; i++) {
    if (Math.abs(col[i + 1] - col[i]) >= 0.75 && flat(i - 8, i + 1) && flat(i + 1, i + 10)) steps++;
  }
  // 2) missing codes where the gradient is shallow (< 0.5 level/px): that is
  //    where posterisation would show as visible bands
  // evaluated per contiguous shallow run (codes must be present within that run)
  const missingSet = new Set();
  let shallowCount = 0;
  let run = [];
  const closeRun = () => {
    if (run.length >= 8) {
      const codes = new Set();
      for (const i of run) box(pts[i][0], pts[i][1], (xx, yy) => codes.add(Math.round(chan(xx, yy))));
      const vals = run.map((i) => avg[i]);
      for (let v = Math.ceil(Math.min(...vals)); v <= Math.floor(Math.max(...vals)); v++) if (!codes.has(v)) missingSet.add(v);
    }
    run = [];
  };
  for (let i = 8; i < avg.length - 8; i++) {
    if (Math.abs(avg[i + 8] - avg[i - 8]) / 16 < 0.5) { run.push(i); shallowCount++; } else closeRun();
  }
  closeRun();
  const missing = [...missingSet].sort((a, b) => a - b);
  const shallow = { length: shallowCount };
  const every = Math.ceil(avg.length / 16);
  const sample = avg.filter((_, i) => i % every === 0).map((v) => v.toFixed(1));
  const rawRow = pts.slice(Math.floor(pts.length * 0.7), Math.floor(pts.length * 0.7) + 24).map(([x, y]) => Math.round(chan(x, y)));
  console.log(`\n[${name}] ${pts.length} px, grain-free range ${Math.min(...avg).toFixed(1)}–${Math.max(...avg).toFixed(1)}`);
  console.log(`  grain-free profile (every ${every} px): ${sample.join(' ')}`);
  console.log(`  raw single-pixel values (24 px at 70%): ${rawRow.join(' ')}`);
  console.log(`  staircase steps (flat → jump → flat): ${steps}`);
  console.log(`  shallow-gradient samples: ${shallow.length}; missing codes there: ${missing.length ? missing.join(',') : 'none'}`);
  return { steps, missing: missing.length };
};

console.log(`${file}  frame ${frame}  ${W}x${H}; beam centre x≈${bestX}`);
const beamPts = [];
for (let x = bestX; x < Math.min(W, bestX + Math.round(W * 0.25)); x++) beamPts.push([x, beamRow]);
const r1 = region('beam falloff (blue channel, centre → outward)', beamPts, (x, y) => px(x, y, 2));
const boardPts = [];
for (let x = Math.round(W * 0.03); x < Math.round(W * 0.30); x++) boardPts.push([x, Math.round(H * 0.93)]);
const r2 = region('dark board (blue channel, bottom-left, horizontal)', boardPts, (x, y) => px(x, y, 2));
const ok = r1.steps === 0 && r2.steps === 0 && r1.missing === 0 && r2.missing === 0;
console.log(`\nBANDING ${ok ? 'PASS' : 'FAIL'}: no staircase steps and no missing codes in shallow gradients`);
process.exitCode = ok ? 0 : 1;
