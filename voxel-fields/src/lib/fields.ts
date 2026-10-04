// The two height fields. Pure functions of the frame number: no state is carried
// from one frame to the next, so any frame can be rendered on its own.

import { makeNoise } from "./random";
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
  /** Column bottoms: just below the deepest canyon floor (-8). */
  bottom: -10,
  // Thresholds on the combined noise value (tuned from its distribution).
  plateauFrom: -0.16,
  /** Noise value where the canyon floor reaches its full depth. */
  floorAt: -0.38,
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
// leave it with no canyons (or all canyon) for seconds at a time. Each frame
// normalises the in-frame base noise (fixed sample cells) so its median sits on
// the plateau and a low percentile sits at the canyon floor. A percentile of a
// continuous field is continuous and periodic in t: motion and loop are kept.
const BALANCE_PERCENTILE = 0.05;
const BALANCE_MID = 0.02;
const BALANCE_LO = -0.46;
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
  const { plateauFrom, floorAt } = CANYON;
  if (n >= plateauFrom) {
    // Flat slabs: level 0 over a wide band, +1 / +2 on the highest ground.
    return terrace((n - plateauFrom) / 0.6, 0.1);
  }
  // Canyon wall: a sheer drop to 5 cubes down, then a solid floor sloping
  // gently to 8 cubes down. Canyons never open into an empty void.
  const wall = 0.05;
  if (n >= plateauFrom - wall) return -5 * smoothstep(plateauFrom, plateauFrom - wall, n);
  const floor = (plateauFrom - wall - n) / (plateauFrom - wall - floorAt);
  return -5 - 3 * smoothstep(0, 1.6, floor);
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
