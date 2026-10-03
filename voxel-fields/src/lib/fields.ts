// The two height fields. Pure functions of the frame number: no state is carried
// from one frame to the next, so any frame can be rendered on its own.

import { makeNoise, mulberry32 } from "./random";
import { inFrameCore } from "./frameArea";

import { loopPhase } from "./time";

export { FPS, LOOP_FRAMES, loopPhase } from "./time";

// Bounding grid of square, one-cube-wide columns. Heights are computed for all
// of it; only the cells the camera can see (plus a margin) are drawn -- see
// visibleCells.ts. The camera looks diagonally, so the box is offset toward the
// far side of the frame.
export const GRID_X = 88;
export const GRID_Z = 88;
export const GRID_OFFSET_X = 16;
export const GRID_OFFSET_Z = -16;
export const COLUMN_COUNT = GRID_X * GRID_Z;

// Column centres sit on half-integers, so cube edges fall on whole world units.
export const columnX = (i: number) => i - GRID_X / 2 + 0.5 + GRID_OFFSET_X;
export const columnZ = (j: number) => j - GRID_Z / 2 + 0.5 + GRID_OFFSET_Z;

const TAU = Math.PI * 2;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Gentle staircase: holds on whole levels, eases between them. */
const terrace = (v: number, soft: number) => {
  const f = Math.floor(v);
  return f + smoothstep(0.5 - soft, 0.5 + soft, v - f);
};

// ---------------------------------------------------------------------------
// Look 1 - Voxel Canyon
// ---------------------------------------------------------------------------

const canyonNoise = makeNoise(0x5eed1);

export const CANYON = {
  /** Column bottoms sit here: deep enough that holes read as a bottomless void. */
  bottom: -90,
  /** Below this, a column is "in the void" and keeps falling. */
  voidTop: -10,
  // Thresholds on the combined noise value (tuned from its distribution).
  plateauFrom: -0.16,
  voidBelow: -0.38,
  /** Radius of the circle in time the noise is sampled on: sets the speed. */
  timeRadius: 0.1,
};

/** Combined 3-scale noise for the canyon at grid cell (x, z) and loop phase t. */
const canyonBase = (x: number, z: number, c: number, s: number) => {
  const { noise4 } = canyonNoise;
  // Each layer samples time around its own circle: at t = 1 the circle closes.
  // Stretched along the grid rows (x), so slabs and canyons form long trenches.
  // Radii of the time circles set the speed: small radius = slow drift.
  const r1 = CANYON.timeRadius;
  const r2 = CANYON.timeRadius * 1.3;
  const n1 = noise4(x * 0.028, z * 0.1, c * r1, s * r1);
  const n2 = noise4(x * 0.06 + 17.3, z * 0.2 - 9.1, c * r2 + 4.2, s * r2 - 3.3);
  return 0.7 * n1 + 0.3 * n2;
};

// Balance: the frame only shows ~30 x 25 columns, so the big noise layer can
// leave it with no holes for seconds at a time. Each frame shifts the field so
// a low percentile of the in-frame base noise (fixed sample cells) sits just
// under the void threshold, so a few holes are always open. A percentile of a
// continuous field is continuous and periodic in t: motion and loop are kept.
const BALANCE_PERCENTILE = 0.08;
const BALANCE_MID = 0.02;
const BALANCE_LO = -0.56;
const balanceCells: [number, number][] = [];
type Balance = { lo: number; mid: number };
const balanceCache = new Map<number, Balance>();
const canyonBalance = (t: number, c: number, s: number) => {
  const hit = balanceCache.get(t);
  if (hit !== undefined) return hit;
  if (balanceCells.length === 0) {
    for (let j = 0; j < GRID_Z; j += 2)
      for (let i = 0; i < GRID_X; i += 2)
        if (inFrameCore(columnX(i), columnZ(j))) balanceCells.push([i, j]);
  }
  const vals = balanceCells.map(([i, j]) => canyonBase(i, j, c, s)).sort((a, b) => a - b);
  const lo = vals[Math.floor(BALANCE_PERCENTILE * (vals.length - 1))];
  const mid = vals[Math.floor(0.5 * (vals.length - 1))];
  const v: Balance = { lo, mid };
  if (balanceCache.size > 2000) balanceCache.clear();
  balanceCache.set(t, v);
  return v;
};

/** Combined 3-scale noise for the canyon at grid cell (x, z) and loop phase t. */
export const canyonNoiseAt = (x: number, z: number, t: number) => {
  const c = Math.cos(TAU * t);
  const s = Math.sin(TAU * t);
  // Per-frame normalisation: the in-frame median maps to BALANCE_MID (plateau)
  // and the low percentile to BALANCE_LO (just past the void threshold).
  const b = canyonBalance(t, c, s);
  const scale = (BALANCE_MID - BALANCE_LO) / Math.max(0.05, b.mid - b.lo);
  const base = BALANCE_MID + (canyonBase(x, z, c, s) - b.mid) * scale;
  // Column-scale layer: makes canyon rims ragged, columns stepping individually.
  // Only acts near and below the rim, so plateau tops stay flat.
  const r3 = CANYON.timeRadius * 1.1;
  const n3 = canyonNoise.noise4(x * 0.55 - 41.7, z * 0.55 + 23.9, c * r3 - 7.7, s * r3 + 2.1);
  const rugged = smoothstep(CANYON.plateauFrom + 0.07, CANYON.plateauFrom - 0.03, base);
  return base + 0.1 * rugged * n3;
};

/**
 * Target height of a column top (in cubes; plateau = 0) from the noise value.
 * Deliberately steep: flat slabs and sheer canyon walls. The motion is made
 * slow by canyonHeightAt, which averages this over a window of frames.
 */
export const canyonHeightFromNoise = (n: number) => {
  const { plateauFrom, voidBelow } = CANYON;
  if (n >= plateauFrom) {
    // Flat slabs: level 0 over a wide band, +1 / +2 on the highest ground.
    return terrace((n - plateauFrom) / 0.6, 0.1);
  }
  // Canyon wall: a sheer drop to 5 cubes down, then a gentle floor to 7 cubes
  // at the void threshold.
  const wall = 0.05;
  if (n >= plateauFrom - wall) return -5 * smoothstep(plateauFrom, plateauFrom - wall, n);
  const floor = -5 - (2 * (plateauFrom - wall - n)) / (plateauFrom - wall - voidBelow);
  if (n >= voidBelow) return floor;
  // Past the threshold the column keeps sinking into the dark.
  const d = (voidBelow - n) / 0.2;
  return Math.max(CANYON.bottom + 6, -7 - 50 * d * d);
};

/** Frames averaged on each side, and the step between samples (frames). */
export const CANYON_SMOOTH = { half: 18, step: 4 };

/**
 * Column height at grid cell (x, z) and frame: the steep target height
 * averaged over a centred window of frames (wrapping round the loop), so a
 * column crossing a slab edge glides up or down over ~1.2 s instead of
 * snapping. Pure function of the frame; frame 600 is frame 0.
 */
export const canyonHeightAt = (x: number, z: number, frame: number) => {
  const { half, step } = CANYON_SMOOTH;
  let sum = 0;
  let n = 0;
  for (let k = -half; k <= half; k += step) {
    const w = 1 - Math.abs(k) / (half + step); // triangular window: eases in/out
    sum += w * canyonHeightFromNoise(canyonNoiseAt(x, z, loopPhase(frame + k)));
    n += w;
  }
  return sum / n;
};

export const canyonHeights = (frame: number, out: Float32Array) => {
  for (let j = 0; j < GRID_Z; j++) {
    for (let i = 0; i < GRID_X; i++) {
      out[j * GRID_X + i] = canyonHeightAt(i, j, frame);
    }
  }
  return out;
};

// Floating cubes: drift on closed paths (whole-number frequencies) above cells
// that often open into the void. Their size follows how open the hole below is.

export type FloatingCube = {
  ax: number; // anchor grid cell
  az: number;
  ox: number; // orbit radius
  oz: number;
  fx: number; // whole-number cycles per loop
  fz: number;
  fy: number;
  fr: number;
  px: number; // phases
  pz: number;
  py: number;
  y: number; // base height
  bob: number;
  size: number;
  axis: [number, number, number];
};

const FLOAT_COUNT = 34;

export const floatingCubes: FloatingCube[] = (() => {
  const rand = mulberry32(0xf10a7);
  // Score cells near the middle of the grid by how often they're in the void.
  const samples = 40;
  const cand: { i: number; j: number; score: number }[] = [];
  for (let j = 0; j < GRID_Z; j += 1) {
    for (let i = 0; i < GRID_X; i += 1) {
      if (!inFrameCore(columnX(i), columnZ(j))) continue;
      let score = 0;
      for (let k = 0; k < samples; k++) {
        const h = canyonHeightFromNoise(canyonNoiseAt(i, j, k / samples));
        if (h < CANYON.voidTop) score++;
      }
      if (score > 0) cand.push({ i, j, score: score + rand() * 0.5 });
    }
  }
  cand.sort((a, b) => b.score - a.score);
  const chosen: { i: number; j: number }[] = [];
  for (const c of cand) {
    if (chosen.length >= FLOAT_COUNT) break;
    if (chosen.some((o) => Math.hypot(o.i - c.i, o.j - c.j) < 4)) continue;
    chosen.push(c);
  }
  return chosen.map(({ i, j }) => {
    const ax = rand() * 2 - 1;
    const ay = rand() * 2 - 1;
    const az = rand() * 2 - 1;
    const al = Math.hypot(ax, ay, az) || 1;
    return {
      ax: i,
      az: j,
      ox: 0.4 + rand() * 0.8,
      oz: 0.4 + rand() * 0.8,
      fx: 1 + Math.floor(rand() * 2),
      fz: 1 + Math.floor(rand() * 2),
      fy: 1 + Math.floor(rand() * 3),
      fr: rand() < 0.5 ? 1 : -1,
      px: rand() * TAU,
      pz: rand() * TAU,
      py: rand() * TAU,
      y: -7 + rand() * 6,
      bob: 0.3 + rand() * 0.5,
      size: 0.55 + rand() * 0.4,
      axis: [ax / al, ay / al, az / al],
    };
  });
})();

export const floatingCubeState = (cube: FloatingCube, frame: number) => {
  const t = loopPhase(frame);
  const x = cube.ax + cube.ox * Math.cos(TAU * cube.fx * t + cube.px);
  const z = cube.az + cube.oz * Math.sin(TAU * cube.fz * t + cube.pz);
  const y = cube.y + cube.bob * Math.sin(TAU * cube.fy * t + cube.py);
  // Visible only while the cell under the cube is open into the void.
  const below = canyonHeightAt(Math.round(x), Math.round(z), frame);
  const open = smoothstep(-5, -22, below);
  return {
    x,
    y,
    z,
    angle: cube.fr * TAU * t,
    scale: cube.size * open,
  };
};

// ---------------------------------------------------------------------------
// Look 2 - Voxel Wave
// ---------------------------------------------------------------------------

const waveNoise = makeNoise(0xa7e2);

export const WAVE = {
  bottom: -3,
  // Ridges run along the grid rows (x) and travel across them (z).
  wavelength: 11, // columns between ridges
  cycles: 2, // whole wavelengths travelled per 600-frame loop
};

export const waveHeightAt = (x: number, z: number, t: number) => {
  const { wavelength, cycles } = WAVE;
  // Travelling wave: moves exactly `cycles` wavelengths per loop. Profile: a
  // stepped rise, a steep face, then a wide flat trough at the base level.
  const p = z / wavelength - cycles * t + (0.06 * x) / wavelength;
  const f = p - Math.floor(p);
  const profile = f < 0.42 ? smoothstep(0, 0.42, f) : 1 - smoothstep(0.42, 0.56, f);
  const c = Math.cos(TAU * t);
  const s = Math.sin(TAU * t);
  // Ridge height varies slowly along the ridge, so ridges step up and down;
  // time is sampled on a circle like look 1.
  const a = waveNoise.noise4(x * 0.07, z * 0.05, c * 0.4, s * 0.4);
  const amp = 3.4 + 1.6 * a; // ~1.8 .. ~5 cubes
  return terrace(Math.max(0, profile * amp - 0.3), 0.2);
};

export const waveHeights = (frame: number, out: Float32Array) => {
  const t = loopPhase(frame);
  for (let j = 0; j < GRID_Z; j++) {
    for (let i = 0; i < GRID_X; i++) {
      out[j * GRID_X + i] = waveHeightAt(i, j, t);
    }
  }
  return out;
};

// ---------------------------------------------------------------------------

export type LookId = "canyon" | "wave";

export const heightsFor = (look: LookId, frame: number, out: Float32Array) =>
  look === "canyon" ? canyonHeights(frame, out) : waveHeights(frame, out);

export const bottomFor = (look: LookId) =>
  look === "canyon" ? CANYON.bottom : WAVE.bottom;

/**
 * For each column, the highest top among it and its 8 neighbours (the rim of
 * its gap, for shading) and the lowest (below that the column is hidden by its
 * neighbours, so its box doesn't need to extend further down).
 */
export const neighbourTops = (h: Float32Array, out: Float32Array, low: Float32Array) => {
  for (let j = 0; j < GRID_Z; j++) {
    for (let i = 0; i < GRID_X; i++) {
      let m = -Infinity;
      let lo = Infinity;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= GRID_Z) continue;
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          if (ii < 0 || ii >= GRID_X) continue;
          const v = h[jj * GRID_X + ii];
          if (v > m) m = v;
          if (v < lo) lo = v;
        }
      }
      out[j * GRID_X + i] = m;
      low[j * GRID_X + i] = lo;
    }
  }
  return out;
};
