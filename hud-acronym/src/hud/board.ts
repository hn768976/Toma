/**
 * Seeded circuit-board routing (module level => identical in every render thread).
 * Traces live on an 8-direction grid (45° bends), with round pads and via dots.
 */
import { mulberry32 } from "./random";
import { SEED } from "./constants";

export const BOARD_W = 17;
export const BOARD_H = 12;
const PITCH = 0.065;
export const TRACE_HALF_W = 0.0058;

const GX = Math.floor(BOARD_W / PITCH);
const GY = Math.floor(BOARD_H / PITCH);
const DIRS: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

export type Trace = {
  pts: [number, number][]; // board-local world coords, merged corners
  length: number;
  intensity: number;
  width: number; // half-width multiplier
  inward: boolean;
};
export type Pad = { x: number; y: number; r: number; rIn: number; intensity: number };

const toWorld = (i: number, j: number): [number, number] => [
  (i - GX / 2) * PITCH,
  (j - GY / 2) * PITCH,
];

const generate = () => {
  const rand = mulberry32(SEED ^ 0x9e3779b9);
  const occ = new Uint8Array(GX * GY);
  const diag = new Set<number>(); // diagonal crossings, keyed by lower-left cell
  const traces: Trace[] = [];
  const pads: Pad[] = [];
  const free = (i: number, j: number) =>
    i > 1 && j > 1 && i < GX - 2 && j < GY - 2 && occ[j * GX + i] === 0;

  const ATTEMPTS = 20000;
  for (let n = 0; n < ATTEMPTS; n++) {
    // Start positions biased toward the centre (denser under the rings).
    const ang = rand() * Math.PI * 2;
    const rr = Math.pow(rand(), 0.75) * 7.5;
    const sx = Math.cos(ang) * rr * 1.1;
    const sy = Math.sin(ang) * rr * 0.8;
    let i = Math.round(sx / PITCH + GX / 2);
    let j = Math.round(sy / PITCH + GY / 2);
    if (!free(i, j)) continue;
    const inward = rand() < 0.5;
    const target = Math.atan2(-sy, -sx);
    const base = inward
      ? ((Math.round(target / (Math.PI / 2)) + 4) % 4) * 2 // inward traces run axis-aligned …
      : Math.floor(rand() * 8); // free traces start in any of the 8 directions
    let dir = base;
    const maxLen = 10 + Math.floor(rand() * (inward ? 140 : 60));
    const path: [number, number][] = [[i, j]];
    const cells: number[] = [j * GX + i];
    occ[j * GX + i] = 2;
    const diagAdded: number[] = [];
    let run = 0;
    for (let s = 0; s < maxLen; s++) {
      // Inward traces re-aim at the centre; everything jogs by 45°.
      if (inward) {
        const [wx, wy] = toWorld(i, j);
        if (Math.hypot(wx, wy) < 0.35) break;
        // … with short 45° jogs toward the centre.
        const want = (Math.round(Math.atan2(-wy, -wx) / (Math.PI / 4)) + 8) % 8;
        if (dir % 2 === 1 && run >= 2 + Math.floor(rand() * 4)) {
          dir = base;
          run = 0;
        } else if (run >= 5 && want !== dir && rand() < 0.18) {
          const dd = ((want - dir + 12) % 8) - 4;
          dir = (dir + Math.sign(dd) + 8) % 8;
          run = 0;
        }
      } else if (run >= 3 && rand() < 0.2) {
        dir = dir === base ? (base + (rand() < 0.5 ? 1 : 7)) % 8 : base;
        run = 0;
      }
      const [dx, dy] = DIRS[dir];
      const ni = i + dx;
      const nj = j + dy;
      let ok = free(ni, nj);
      let dkey = -1;
      if (ok && dx !== 0 && dy !== 0) {
        dkey = Math.min(j, nj) * GX + Math.min(i, ni);
        if (diag.has(dkey)) ok = false;
      }
      if (!ok) break;
      if (dkey >= 0) {
        diag.add(dkey);
        diagAdded.push(dkey);
      }
      i = ni;
      j = nj;
      occ[j * GX + i] = 2;
      cells.push(j * GX + i);
      path.push([i, j]);
      run++;
    }
    if (path.length < 6) {
      for (const c of cells) occ[c] = 0;
      for (const d of diagAdded) diag.delete(d);
      continue;
    }
    for (const c of cells) occ[c] = 1;
    // Merge collinear steps.
    const pts: [number, number][] = [toWorld(path[0][0], path[0][1])];
    for (let k = 1; k < path.length - 1; k++) {
      const ax = path[k][0] - path[k - 1][0];
      const ay = path[k][1] - path[k - 1][1];
      const bx = path[k + 1][0] - path[k][0];
      const by = path[k + 1][1] - path[k][1];
      if (ax !== bx || ay !== by) pts.push(toWorld(path[k][0], path[k][1]));
    }
    const last = path[path.length - 1];
    pts.push(toWorld(last[0], last[1]));
    let length = 0;
    for (let k = 1; k < pts.length; k++)
      length += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    // Varied brightness and weight; a few traces are bright highlights.
    const hi = rand();
    const intensity = hi < 0.08 ? 1.8 + rand() : 0.35 + rand() * 0.65;
    const width = 0.65 + rand() * 0.8;
    traces.push({ pts, length, intensity, width, inward });
    // End decorations: hollow pads and via dots.
    for (const [end, p] of [
      [0, pts[0]],
      [1, pts[pts.length - 1]],
    ] as const) {
      const r = rand();
      if (r < 0.7) pads.push({ x: p[0], y: p[1], r: TRACE_HALF_W * 3.2, rIn: TRACE_HALF_W * 1.5, intensity });
      else if (r < 0.85) pads.push({ x: p[0], y: p[1], r: TRACE_HALF_W * 2.2, rIn: 0, intensity });
      void end;
    }
  }
  // Scattered vias in empty space.
  for (let n = 0; n < 4000; n++) {
    const i = 2 + Math.floor(rand() * (GX - 4));
    const j = 2 + Math.floor(rand() * (GY - 4));
    if (occ[j * GX + i] || occ[j * GX + i + 1] || occ[j * GX + i - 1]) continue;
    const [x, y] = toWorld(i, j);
    pads.push({ x, y, r: TRACE_HALF_W * 2.4, rIn: rand() < 0.5 ? TRACE_HALF_W * 1.1 : 0, intensity: 0.5 + rand() * 0.4 });
  }

  // Pulses: long inward traces whose inner end lands near the rings.
  const candidates = traces
    .filter((t) => {
      const e = t.pts[t.pts.length - 1];
      return t.inward && t.length > 2.0 && Math.hypot(e[0], e[1]) < 1.9;
    })
    .sort((a, b) => b.length - a.length);
  const pulses = candidates.slice(0, 14).map((t) => ({
    trace: t,
    repeats: 2 + Math.floor(rand() * 3), // whole number of passes per loop
    offset: rand(),
  }));
  return { traces, pads, pulses };
};

export const BOARD = generate();
