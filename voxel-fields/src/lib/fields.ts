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
  plateauFrom: -0.08,
  voidBelow: -0.27,
};

/** Combined 3-scale noise for the canyon at grid cell (x, z) and loop phase t. */
const canyonBase = (x: number, z: number, c: number, s: number) => {
  const { noise4 } = canyonNoise;
  // Each layer samples time around its own circle: at t = 1 the circle closes.
  // Stretched along the grid rows (x), so slabs and canyons form long trenches.
  const n1 = noise4(x * 0.028, z * 0.1, c * 0.5, s * 0.5);
  const n2 = noise4(x * 0.06 + 17.3, z * 0.2 - 9.1, c * 0.7 + 4.2, s * 0.7 - 3.3);
  return 0.7 * n1 + 0.3 * n2;
};

// Balance: the frame only shows ~30 x 25 columns, so the big noise layer can
// leave it with no holes for seconds at a time. Each frame shifts the field so
// a low percentile of the in-frame base noise (fixed sample cells) sits just
// under the void threshold, so a few holes are always open. A percentile of a
// continuous field is continuous and periodic in t: motion and loop are kept.
const BALANCE_PERCENTILE = 0.05;
const balanceCells: [number, number][] = [];
const balanceCache = new Map<number, number>();
const canyonBalance = (t: number, c: number, s: number) => {
  const hit = balanceCache.get(t);
  if (hit !== undefined) return hit;
  if (balanceCells.length === 0) {
    for (let j = 0; j < GRID_Z; j += 2)
      for (let i = 0; i < GRID_X; i += 2)
        if (inFrameCore(columnX(i), columnZ(j))) balanceCells.push([i, j]);
  }
  const vals = balanceCells.map(([i, j]) => canyonBase(i, j, c, s)).sort((a, b) => a - b);
  const q = vals[Math.floor(BALANCE_PERCENTILE * (vals.length - 1))];
  const v = 0.8 * (q - (CANYON.voidBelow - 0.03));
  if (balanceCache.size > 2000) balanceCache.clear();
  balanceCache.set(t, v);
  return v;
};

/** Combined 3-scale noise for the canyon at grid cell (x, z) and loop phase t. */
export const canyonNoiseAt = (x: number, z: number, t: number) => {
  const c = Math.cos(TAU * t);
  const s = Math.sin(TAU * t);
  const base = canyonBase(x, z, c, s) - canyonBalance(t, c, s);
  // Column-scale layer: makes canyon rims ragged, columns stepping individually.
  // Only acts near and below the rim, so plateau tops stay flat.
  const n3 = canyonNoise.noise4(x * 0.55 - 41.7, z * 0.55 + 23.9, c * 0.9 - 7.7, s * 0.9 + 2.1);
  const rugged = smoothstep(CANYON.plateauFrom + 0.07, CANYON.plateauFrom - 0.03, base);
  return base + 0.1 * rugged * n3;
};

/** Height of the column top (in cubes; plateau = 0) from the noise value. */
export const canyonHeightFromNoise = (n: number) => {
  const { plateauFrom, voidBelow } = CANYON;
  if (n >= plateauFrom) {
    // Plateau slabs: level 0 over a wide band, then +1, +2 on the highest ground.
    return terrace((n - plateauFrom) / 0.4, 0.12);
  }
  // Canyon: drops in 4-cube steps to the mid levels, then into the void.
  const steps = (n - plateauFrom) / ((plateauFrom - voidBelow) / 2); // 0 .. -2
  const canyon = 4 * terrace(Math.max(steps, -2), 0.2);
  // Past the threshold the column keeps falling, accelerating into the dark.
  const d = Math.min(1, Math.max(0, (voidBelow - n) / 0.22));
  const fall = d * d * (2 - d);
  return canyon + fall * (CANYON.bottom + 6 - canyon);
};

export const canyonHeights = (frame: number, out: Float32Array) => {
  const t = loopPhase(frame);
  for (let j = 0; j < GRID_Z; j++) {
    for (let i = 0; i < GRID_X; i++) {
      out[j * GRID_X + i] = canyonHeightFromNoise(canyonNoiseAt(i, j, t));
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
  const below = canyonHeightFromNoise(
    canyonNoiseAt(Math.round(x), Math.round(z), t),
  );
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
