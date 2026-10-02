import { LOOP_FRAMES } from "../common/constants";
import { mulberry32, range } from "../common/random";

/**
 * Everything procedural about the chip is generated here, once, at module
 * load, from fixed seeds: the cell schedule texture data, the circuit traces,
 * the filaments and the sparks. Render code only looks these up by frame.
 */

/* ── Block dimensions (world units) ─────────────────────────────────────── */
export const CHIP = { w: 8, h: 0.9, d: 5, radius: 0.07 };
export const CELL = 0.075; // grid cell size

export const COLS_X = Math.round(CHIP.w / CELL); // 107
export const COLS_Z = Math.round(CHIP.d / CELL); // 67
export const ROWS_Y = Math.round(CHIP.h / CELL); // 12

/**
 * Cell atlas, one texel per cell: rows 0..COLS_Z-1 are the top face
 * (x across, z down), then 4 bands of ROWS_Y rows for the side faces
 * (+z, -z, +x, -x).
 */
export const ATLAS_W = 128;
export const ATLAS_H = 128;
export const SIDE_ROW0 = COLS_Z; // first row of the side bands

/**
 * Per cell (RGBA float):
 *   R = base level (0..1; > 0.92 means a permanently lit cell)
 *   G = start frame of twinkle event 1 (or -1)
 *   B = start frame of twinkle event 2 (or -1)
 *   A = twinkle duration in frames
 * The shader evaluates the schedule at frame % 600, so the twinkle loops.
 */
export const CELL_DATA = (() => {
  const rand = mulberry32(0xc417);
  const data = new Float32Array(ATLAS_W * ATLAS_H * 4);
  for (let i = 0; i < ATLAS_W * ATLAS_H; i++) {
    const base = rand();
    const lvl = base > 0.994 ? 0.95 : 0.25 + 0.6 * Math.pow(rand(), 1.6);
    const hasA = rand() < 0.16;
    const hasB = rand() < 0.05;
    data[i * 4] = lvl;
    data[i * 4 + 1] = hasA ? Math.floor(rand() * LOOP_FRAMES) : -1;
    data[i * 4 + 2] = hasB ? Math.floor(rand() * LOOP_FRAMES) : -1;
    data[i * 4 + 3] = Math.floor(range(rand, 14, 70));
  }
  return data;
})();

/* ── Ribbons (traces, filaments) ────────────────────────────────────────── */

type V3 = [number, number, number];

export type Ribbon = {
  points: V3[];
  normals: V3[]; // face normal at each segment start (segment i uses normals[i])
  width: number;
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export type RibbonBuffers = {
  position: Float32Array;
  dist: Float32Array; // distance along the ribbon at this vertex
  total: Float32Array; // ribbon length
  side: Float32Array; // -1..1 across the ribbon
  seed: Float32Array; // per-ribbon id (0..1) and pulse params
  pulse: Float32Array; // vec4: k1, off1, k2, off2 (k = whole cycles per loop)
  index: Uint32Array;
};

/** Turns polylines into flat quads (two triangles per segment). */
export const buildRibbons = (
  ribbons: Ribbon[],
  pulses: [number, number, number, number][],
): RibbonBuffers => {
  const pos: number[] = [];
  const dist: number[] = [];
  const total: number[] = [];
  const side: number[] = [];
  const seed: number[] = [];
  const pulse: number[] = [];
  const index: number[] = [];
  ribbons.forEach((r, ri) => {
    let L = 0;
    for (let i = 0; i < r.points.length - 1; i++) L += len(sub(r.points[i + 1], r.points[i]));
    let acc = 0;
    for (let i = 0; i < r.points.length - 1; i++) {
      const a = r.points[i];
      const b = r.points[i + 1];
      const seg = len(sub(b, a));
      const dir = norm(sub(b, a));
      const s = norm(cross(dir, r.normals[i]));
      const hw = r.width / 2;
      // extend each segment by half a width so joints overlap cleanly
      const ax: V3 = [a[0] - dir[0] * hw, a[1] - dir[1] * hw, a[2] - dir[2] * hw];
      const bx: V3 = [b[0] + dir[0] * hw, b[1] + dir[1] * hw, b[2] + dir[2] * hw];
      const base = pos.length / 3;
      for (const [p, d] of [
        [ax, acc - hw],
        [bx, acc + seg + hw],
      ] as [V3, number][]) {
        for (const sg of [-1, 1]) {
          pos.push(p[0] + s[0] * hw * sg, p[1] + s[1] * hw * sg, p[2] + s[2] * hw * sg);
          dist.push(d);
          total.push(L);
          side.push(sg);
          seed.push((ri * 0.6180339887) % 1);
          pulse.push(...pulses[ri]);
        }
      }
      index.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      acc += seg;
    }
  });
  return {
    position: new Float32Array(pos),
    dist: new Float32Array(dist),
    total: new Float32Array(total),
    side: new Float32Array(side),
    seed: new Float32Array(seed),
    pulse: new Float32Array(pulse),
    index: new Uint32Array(index),
  };
};

/* ── Circuit traces ─────────────────────────────────────────────────────── */

const TOP_Y = CHIP.h + 0.004;
const BOARD_Y = 0.004;
const UP: V3 = [0, 1, 0];

// 8 directions on a plane, 45 degree steps
const DIRS: [number, number][] = [
  [1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2],
  [-1, 0], [-Math.SQRT1_2, -Math.SQRT1_2], [0, -1], [Math.SQRT1_2, -Math.SQRT1_2],
];

const snap = (v: number) => Math.round(v / CELL) * CELL; // traces run in the gaps

/** A trace that starts on the top face, wanders with 45/90 deg turns, then
 * leaves over an edge, runs down the side and out across the board. */
const topTrace = (rand: () => number): Ribbon => {
  const hx = CHIP.w / 2;
  const hz = CHIP.d / 2;
  let x = snap(range(rand, -hx * 0.85, hx * 0.85));
  let z = snap(range(rand, -hz * 0.85, hz * 0.85));
  // head toward the nearest long or short edge
  const toEdge = [hx - x, hz - z, hx + x, hz + z];
  let edge = toEdge.indexOf(Math.min(...toEdge));
  if (edge === 3) edge = rand() < 0.5 ? 0 : 2; // nothing runs off the far edge
  const mainDir = [0, 2, 4, 6][edge];
  let d = rand() < 0.5 ? mainDir : (mainDir + (rand() < 0.5 ? 2 : 6)) % 8;
  const pts: V3[] = [[x, TOP_Y, z]];
  const nrm: V3[] = [];
  for (let step = 0; step < 6; step++) {
    const l = range(rand, 0.25, 1.4);
    let nx = x + DIRS[d][0] * l;
    let nz = z + DIRS[d][1] * l;
    nx = Math.max(-hx, Math.min(hx, nx));
    nz = Math.max(-hz, Math.min(hz, nz));
    x = nx;
    z = nz;
    pts.push([x, TOP_Y, z]);
    nrm.push(UP);
    if (Math.abs(x) >= hx - 1e-6 || Math.abs(z) >= hz - 1e-6) break;
    // turn: back toward the main direction, or 45 deg off it
    const turn = rand();
    if (d !== mainDir) d = turn < 0.6 ? mainDir : d;
    else d = turn < 0.3 ? (mainDir + 1) % 8 : turn < 0.6 ? (mainDir + 7) % 8 : mainDir;
  }
  // force the last leg to the edge
  const last = pts[pts.length - 1];
  const ex = edge === 0 ? hx : edge === 2 ? -hx : last[0];
  const ez = edge === 1 ? hz : edge === 3 ? -hz : last[2];
  if (Math.abs(last[0] - ex) > 1e-4 || Math.abs(last[2] - ez) > 1e-4) {
    pts.push([ex, TOP_Y, ez]);
    nrm.push(UP);
  }
  // down the side
  const out: V3 =
    edge === 0 ? [1, 0, 0] : edge === 1 ? [0, 0, 1] : edge === 2 ? [-1, 0, 0] : [0, 0, -1];
  const e = 0.004;
  const [px, , pz] = pts[pts.length - 1];
  pts.push([px + out[0] * e, CHIP.h * 0.98, pz + out[2] * e]);
  nrm.push(out);
  pts.push([px + out[0] * e, BOARD_Y, pz + out[2] * e]);
  nrm.push(out);
  // out across the board
  let bx = px + out[0] * e;
  let bz = pz + out[2] * e;
  const outDir = DIRS.findIndex((v) => Math.abs(v[0] - out[0]) < 1e-6 && Math.abs(v[1] - out[2]) < 1e-6);
  let bd = outDir;
  for (let step = 0; step < 4; step++) {
    const l = range(rand, 0.4, 1.8);
    bx += DIRS[bd][0] * l;
    bz += DIRS[bd][1] * l;
    pts.push([bx, BOARD_Y, bz]);
    nrm.push(UP);
    const t = rand();
    bd = t < 0.35 ? (outDir + 1) % 8 : t < 0.7 ? (outDir + 7) % 8 : outDir;
  }
  return { points: pts, normals: nrm, width: 0.016 };
};

/** Traces that live only on the board, fanning out from under the chip. */
const boardTrace = (rand: () => number): Ribbon => {
  const side = Math.floor(rand() * 3); // not behind the chip
  const hx = CHIP.w / 2;
  const hz = CHIP.d / 2;
  const t = range(rand, -0.95, 0.95);
  let x = side === 0 ? hx + 0.06 : side === 2 ? -hx - 0.06 : t * hx;
  let z = side === 1 ? hz + 0.06 : side === 3 ? -hz - 0.06 : t * hz;
  const outDir = [0, 2, 4, 6][side];
  let d = outDir;
  const pts: V3[] = [[x, BOARD_Y, z]];
  const nrm: V3[] = [];
  for (let step = 0; step < 5; step++) {
    const l = range(rand, 0.3, 2.2);
    x += DIRS[d][0] * l;
    z += DIRS[d][1] * l;
    pts.push([x, BOARD_Y, z]);
    nrm.push(UP);
    const r = rand();
    d = r < 0.3 ? (outDir + 1) % 8 : r < 0.6 ? (outDir + 7) % 8 : outDir;
  }
  return { points: pts, normals: nrm, width: 0.022 };
};

/** Short traces confined to a side face (the reference has them there too). */
const sideTrace = (rand: () => number): Ribbon => {
  const face = Math.floor(rand() * 2); // 0: +z, 1: +x (the faces the camera sees)
  const n: V3 = face === 0 ? [0, 0, 1] : [1, 0, 0];
  const span = face === 0 ? CHIP.w / 2 : CHIP.d / 2;
  let u = snap(range(rand, -span * 0.9, span * 0.9));
  let v = snap(range(rand, CHIP.h * 0.15, CHIP.h * 0.85));
  const e = 0.004;
  const to3 = (uu: number, vv: number): V3 =>
    face === 0 ? [uu, vv, CHIP.d / 2 + e] : [CHIP.w / 2 + e, vv, -uu];
  const pts: V3[] = [to3(u, v)];
  const nrm: V3[] = [];
  let horiz = true;
  for (let step = 0; step < 4; step++) {
    if (horiz) u = Math.max(-span, Math.min(span, u + range(rand, -1.2, 1.2)));
    else v = Math.max(0.05, Math.min(CHIP.h - 0.05, v + range(rand, -0.4, 0.4)));
    pts.push(to3(u, v));
    nrm.push(n);
    horiz = !horiz;
  }
  return { points: pts, normals: nrm, width: 0.012 };
};

export const TRACES = (() => {
  const rand = mulberry32(0x7ace5);
  const ribbons: Ribbon[] = [];
  for (let i = 0; i < 46; i++) ribbons.push(topTrace(rand));
  for (let i = 0; i < 70; i++) ribbons.push(boardTrace(rand));
  for (let i = 0; i < 26; i++) ribbons.push(sideTrace(rand));
  // pulses: k = whole number of trips per 600-frame loop
  const pulses = ribbons.map(
    () =>
      [
        1 + Math.floor(rand() * 3),
        rand(),
        rand() < 0.5 ? 2 + Math.floor(rand() * 3) : 0,
        rand(),
      ] as [number, number, number, number],
  );
  return buildRibbons(ribbons, pulses);
})();

/* ── Filaments: fine jagged electric arcs along the top edges ───────────── */

export const FILAMENTS = (() => {
  const rand = mulberry32(0xf11a);
  const ribbons: Ribbon[] = [];
  const sched: [number, number, number, number][] = [];
  const hx = CHIP.w / 2;
  const hz = CHIP.d / 2;
  for (let i = 0; i < 90; i++) {
    // a point on the top rim of the +z or +x edge (camera side) or the others
    const e = Math.floor(rand() * 4);
    const t = range(rand, -0.95, 0.95);
    const p: V3 =
      e === 0 ? [t * hx, CHIP.h, hz] : e === 1 ? [hx, CHIP.h, t * hz] : e === 2 ? [t * hx, CHIP.h, -hz] : [-hx, CHIP.h, t * hz];
    const along: V3 = e === 0 || e === 2 ? [1, 0, 0] : [0, 0, 1];
    const out: V3 = e === 0 ? [0, 0, 1] : e === 1 ? [1, 0, 0] : e === 2 ? [0, 0, -1] : [-1, 0, 0];
    const pts: V3[] = [];
    const nrm: V3[] = [];
    const n = 7 + Math.floor(rand() * 6);
    const dirSign = rand() < 0.5 ? -1 : 1;
    let a = 0;
    for (let k = 0; k < n; k++) {
      const jitterUp = range(rand, -0.05, 0.12) * (k === 0 ? 0 : 1);
      const jitterOut = range(rand, -0.02, 0.06) * (k === 0 ? 0 : 1);
      pts.push([
        p[0] + along[0] * a * dirSign + out[0] * jitterOut,
        p[1] + jitterUp + 0.01,
        p[2] + along[2] * a * dirSign + out[2] * jitterOut,
      ]);
      if (k > 0) nrm.push(out);
      a += range(rand, 0.03, 0.09);
    }
    ribbons.push({ points: pts, normals: nrm, width: 0.006 });
    // flicker schedule: two short bursts per loop (start, duration)
    sched.push([
      Math.floor(rand() * LOOP_FRAMES),
      Math.floor(range(rand, 4, 16)),
      Math.floor(rand() * LOOP_FRAMES),
      Math.floor(range(rand, 3, 12)),
    ]);
  }
  return buildRibbons(ribbons, sched);
})();

/* ── Sparks: tiny points near the rims with on/off schedules ────────────── */

export const SPARKS = (() => {
  const rand = mulberry32(0x5a4c);
  const n = 260;
  const pos = new Float32Array(n * 3);
  const sched = new Float32Array(n * 4);
  const hx = CHIP.w / 2;
  const hz = CHIP.d / 2;
  for (let i = 0; i < n; i++) {
    const e = Math.floor(rand() * 4);
    const t = range(rand, -1, 1);
    const off = range(rand, 0, 0.12);
    const y = CHIP.h + range(rand, -0.25, 0.18);
    const p =
      e === 0 ? [t * hx, y, hz + off] : e === 1 ? [hx + off, y, t * hz] : e === 2 ? [t * hx, y, -hz - off] : [-hx - off, y, t * hz];
    pos.set(p, i * 3);
    sched.set(
      [Math.floor(rand() * LOOP_FRAMES), Math.floor(range(rand, 3, 14)), Math.floor(rand() * LOOP_FRAMES), range(rand, 0.5, 1.6)],
      i * 4,
    );
  }
  return { pos, sched };
})();
