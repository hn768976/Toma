import { COUNTS, SEED, SIZES } from "../config";
import { mulberry32 } from "../lib/rng";

// Procedural circuit board, generated once from a fixed seed.

export type Segment = {
  x0: number; z0: number; x1: number; z1: number;
  d0: number; d1: number; // path distance from the chip at each end (drives the light wave)
  bright: number; // 0 dim .. 1 lit
  seed: number;
  width: number;
};
export type Box = {
  x: number; z: number; sx: number; sz: number; h: number;
  shade: number; // albedo variation
};
export type Part = {
  x: number; z: number; sx: number; sz: number; h: number;
  kind: 0 | 1 | 2 | 3; // 0 white part, 1 cyan bar, 2 accent, 3 via pad at a trace end
  seed: number;
};

const DIRS: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

export const buildBoard = () => {
  const rnd = mulberry32(SEED);
  const g = SIZES.grid;
  const N = Math.round((SIZES.boardHalf * 2) / g); // cells per side
  const half = N / 2;
  const occ = new Int32Array(N * N); // 0 free, >0 bundle id, -1 reserved
  const inside = (i: number, j: number) => i >= 2 && j >= 2 && i < N - 2 && j < N - 2;
  const at = (i: number, j: number) => occ[j * N + i];
  const toWorld = (i: number) => (i - half) * g;

  const segments: Segment[] = [];
  const parts: Part[] = [];

  // keep the chip area clear
  const keep = Math.ceil(SIZES.frameHalf / g) + 1;
  for (let j = -keep; j <= keep; j++)
    for (let i = -keep; i <= keep; i++) occ[(j + half) * N + (i + half)] = -1;

  let bundleId = 1;

  /** walk one polyline on the grid; returns the cells or null if blocked immediately */
  const walk = (
    si: number, sj: number, dir: number, plan: { len: number; turn: number }[], id: number,
  ) => {
    const pts: [number, number][] = [[si, sj]];
    const cells: [number, number][] = [[si, sj]];
    let i = si, j = sj, d = dir;
    let blocked = false;
    for (const step of plan) {
      d = (d + step.turn + 8) % 8;
      let moved = 0;
      for (let k = 0; k < step.len; k++) {
        const ni = i + DIRS[d][0], nj = j + DIRS[d][1];
        if (!inside(ni, nj)) { blocked = true; break; }
        const o = at(ni, nj);
        if (o !== 0 && o !== id) { blocked = true; break; }
        // diagonal moves must not squeeze between two foreign cells
        if (DIRS[d][0] !== 0 && DIRS[d][1] !== 0) {
          const a = at(ni, j), b = at(i, nj);
          if (a !== 0 && a !== id && b !== 0 && b !== id) { blocked = true; break; }
        }
        i = ni; j = nj; moved++;
        cells.push([i, j]);
      }
      if (moved > 0) pts.push([i, j]);
      if (blocked) break;
    }
    return { pts, cells, blocked };
  };

  const commit = (
    pts: [number, number][], cells: [number, number][], id: number, startDist: number,
    bright: number, width: number, pad: boolean,
  ) => {
    for (const [ci, cj] of cells) occ[cj * N + ci] = id;
    let dist = startDist;
    const seed = rnd();
    for (let k = 0; k < pts.length - 1; k++) {
      const x0 = toWorld(pts[k][0]), z0 = toWorld(pts[k][1]);
      const x1 = toWorld(pts[k + 1][0]), z1 = toWorld(pts[k + 1][1]);
      const len = Math.hypot(x1 - x0, z1 - z0);
      segments.push({ x0, z0, x1, z1, d0: dist, d1: dist + len, bright, seed, width });
      dist += len;
    }
    if (pad && pts.length > 1) {
      const [pi, pj] = pts[pts.length - 1];
      parts.push({ x: toWorld(pi), z: toWorld(pj), sx: g * 0.55, sz: g * 0.55, h: 0.006, kind: 3, seed: rnd() });
    }
  };

  // ---- traces leaving the chip, in parallel bundles
  const pinCells = Math.floor(SIZES.dieHalf / g); // pins span +-pinCells
  for (let n = 0; n < COUNTS.chipTraceGroups; n++) {
    const side = n % 4; // 0 +x, 1 +z, 2 -x, 3 -z
    const dir = side * 2;
    const count = 1 + Math.floor(rnd() * 3);
    const first = Math.round((rnd() * 2 - 1) * (pinCells - count));
    const plan: { len: number; turn: number }[] = [];
    let turnSign = rnd() < 0.5 ? 1 : -1;
    let rel = 0;
    plan.push({ len: 4 + Math.floor(rnd() * 22), turn: 0 });
    const nSteps = 2 + Math.floor(rnd() * 5);
    for (let s = 0; s < nSteps; s++) {
      // stay within +-45 deg of the exit direction so bundle members never cross
      let turn = rel === 0 ? turnSign : -rel;
      if (rel === 0 && rnd() < 0.5) turnSign = -turnSign;
      rel += turn;
      plan.push({ len: 6 + Math.floor(rnd() * (rel === 0 ? 70 : 28)), turn });
    }
    const bright = rnd() < 0.55 ? 1 : 0.35;
    const id = bundleId++;
    for (let c = 0; c < count; c++) {
      const off = first + c * 2;
      if (Math.abs(off) > pinCells) continue;
      const e = keep + 1;
      const si = half + (side === 0 ? e : side === 2 ? -e : off);
      const sj = half + (side === 1 ? e : side === 3 ? -e : off);
      if (at(si, sj) !== 0) continue;
      const w = walk(si, sj, dir, plan, id);
      if (w.cells.length < 4) continue;
      // lead-in from the frame to the first cell
      const fx = side === 0 ? SIZES.frameHalf : side === 2 ? -SIZES.frameHalf : toWorld(si);
      const fz = side === 1 ? SIZES.frameHalf : side === 3 ? -SIZES.frameHalf : toWorld(sj);
      segments.push({
        x0: fx, z0: fz, x1: toWorld(si), z1: toWorld(sj), d0: 0, d1: g * 2, bright, seed: rnd(), width: 0.0045,
      });
      commit(w.pts, w.cells, id, g * 2, bright, 0.0045, true);
    }
  }

  // ---- free traces elsewhere on the board
  for (let n = 0; n < COUNTS.freeTraceBundles; n++) {
    // denser near the middle of the board
    const rad = Math.pow(rnd(), 0.75) * (half - 6);
    const ang = rnd() * Math.PI * 2;
    const ci = Math.round(half + Math.cos(ang) * rad);
    const cj = Math.round(half + Math.sin(ang) * rad);
    const dir = Math.floor(rnd() * 4) * 2 + (rnd() < 0.25 ? 1 : 0);
    const count = 1 + Math.floor(rnd() * rnd() * 5);
    const plan: { len: number; turn: number }[] = [];
    let rel = 0;
    let turnSign = rnd() < 0.5 ? 1 : -1;
    plan.push({ len: 5 + Math.floor(rnd() * 50), turn: 0 });
    const nSteps = 1 + Math.floor(rnd() * 5);
    for (let s = 0; s < nSteps; s++) {
      const turn = rel === 0 ? turnSign : -rel;
      if (rel === 0 && rnd() < 0.5) turnSign = -turnSign;
      rel += turn;
      plan.push({ len: 5 + Math.floor(rnd() * (rel === 0 ? 90 : 30)), turn });
    }
    const bright = rnd() < 0.3 ? 1 : rnd() < 0.5 ? 0.45 : 0.2;
    const id = bundleId++;
    // offset perpendicular to the first direction
    const px = -DIRS[dir][1], pz = DIRS[dir][0];
    const gap = dir % 2 === 0 ? 2 : 1;
    const startDist = Math.hypot(toWorld(ci), toWorld(cj));
    for (let c = 0; c < count; c++) {
      const si = ci + px * c * gap, sj = cj + pz * c * gap;
      if (!inside(si, sj) || at(si, sj) !== 0) continue;
      const w = walk(si, sj, dir, plan, id);
      if (w.cells.length < 8) continue;
      commit(w.pts, w.cells, id, startDist, bright, 0.004, rnd() < 0.7);
    }
  }

  // ---- small lit parts (reserve their cells)
  const reserve = (i0: number, j0: number, ni: number, nj: number, test: boolean) => {
    for (let j = j0 - 1; j <= j0 + nj; j++)
      for (let i = i0 - 1; i <= i0 + ni; i++) {
        if (!inside(i, j)) return false;
        if (test && at(i, j) !== 0) return false;
      }
    if (test) return true;
    for (let j = j0; j < j0 + nj; j++) for (let i = i0; i < i0 + ni; i++) occ[j * N + i] = -1;
    return true;
  };
  const randCell = (pow: number) => {
    const rad = Math.pow(rnd(), pow) * (half - 4);
    const ang = rnd() * Math.PI * 2;
    return [Math.round(half + Math.cos(ang) * rad), Math.round(half + Math.sin(ang) * rad)];
  };
  for (let n = 0; n < COUNTS.components; n++) {
    const [i0, j0] = randCell(0.7);
    const big = rnd() < 0.3;
    const ni = big ? 2 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 2);
    const nj = big ? 2 + Math.floor(rnd() * 2) : 1;
    const flip = rnd() < 0.5;
    const a = flip ? nj : ni, b = flip ? ni : nj;
    if (!reserve(i0, j0, a, b, true)) continue;
    reserve(i0, j0, a, b, false);
    const kind = rnd() < 0.035 ? 2 : 0;
    parts.push({
      x: toWorld(i0) + (a * g) / 2 - g / 2, z: toWorld(j0) + (b * g) / 2 - g / 2,
      sx: a * g * 0.62, sz: b * g * 0.62, h: 0.004 + rnd() * 0.004, kind, seed: rnd(),
    });
  }
  // tight clusters of small bright parts (the "populated" patches of a board)
  for (let n = 0; n < COUNTS.partClusters; n++) {
    const [ci, cj] = randCell(0.7);
    const count = 4 + Math.floor(rnd() * 9);
    for (let k = 0; k < count; k++) {
      const i0 = ci + Math.floor((rnd() - 0.5) * 9), j0 = cj + Math.floor((rnd() - 0.5) * 7);
      const a = 1 + Math.floor(rnd() * 2), b = 1;
      const flip = rnd() < 0.5;
      const ni = flip ? b : a, nj = flip ? a : b;
      if (!reserve(i0, j0, ni, nj, true)) continue;
      reserve(i0, j0, ni, nj, false);
      parts.push({
        x: toWorld(i0) + (ni * g) / 2 - g / 2, z: toWorld(j0) + (nj * g) / 2 - g / 2,
        sx: ni * g * 0.7, sz: nj * g * 0.7, h: 0.004 + rnd() * 0.004, kind: rnd() < 0.45 ? 1 : 0, seed: rnd(),
      });
    }
  }
  for (let n = 0; n < COUNTS.barClusters; n++) {
    const [i0, j0] = randCell(0.75);
    const bars = 3 + Math.floor(rnd() * 9);
    const len = 2 + Math.floor(rnd() * 5);
    const flip = rnd() < 0.5;
    const a = flip ? len : bars, b = flip ? bars : len;
    if (!reserve(i0, j0, a, b, true)) continue;
    reserve(i0, j0, a, b, false);
    const accent = rnd() < 0.08;
    for (let k = 0; k < bars; k++) {
      if (rnd() < 0.2) continue;
      const l = len * g * (0.4 + rnd() * 0.6);
      parts.push({
        x: toWorld(i0) + (flip ? (len * g) / 2 - g / 2 : k * g),
        z: toWorld(j0) + (flip ? k * g : (len * g) / 2 - g / 2),
        sx: flip ? l : g * 0.32, sz: flip ? g * 0.32 : l, h: 0.01, kind: accent ? 2 : 1, seed: rnd(),
      });
    }
  }

  // ---- dark relief blocks filling the free space
  const boxes: Box[] = [];
  for (let n = 0; n < COUNTS.greebleAttempts; n++) {
    const [i0, j0] = randCell(0.62);
    const r = rnd();
    const ni = r < 0.6 ? 1 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 9);
    const nj = r < 0.6 ? 1 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 6);
    let ok = true;
    for (let j = j0; j < j0 + nj && ok; j++)
      for (let i = i0; i < i0 + ni; i++)
        if (!inside(i, j) || at(i, j) !== 0) { ok = false; break; }
    if (!ok) continue;
    for (let j = j0; j < j0 + nj; j++) for (let i = i0; i < i0 + ni; i++) occ[j * N + i] = -2;
    boxes.push({
      x: toWorld(i0) + (ni * g) / 2 - g / 2, z: toWorld(j0) + (nj * g) / 2 - g / 2,
      sx: ni * g - g * 0.22, sz: nj * g - g * 0.22,
      h: 0.002 + rnd() * rnd() * 0.009, shade: 0.42 + rnd() * rnd() * 0.3,
    });
  }

  return { segments, parts, boxes };
};
