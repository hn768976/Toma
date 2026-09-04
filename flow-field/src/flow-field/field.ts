import {
  BRIGHT_TIME_RADIUS,
  BRIGHT_WAVELENGTH,
  BRIGHT_WAVELENGTH_2,
  FIELD_OCTAVES,
  FIELD_TIME_RADIUS,
  FIELD_X0,
  FIELD_X1,
  FIELD_Z0,
  FIELD_Z1,
  GRID_X,
  GRID_Z,
  RELIEF_OCTAVES,
  RELIEF_TIME_RADIUS,
} from "./constants";
import { createNoise4D, type Noise4D } from "./noise";

/**
 * The flow field, the surface relief and the brightness field, all sampled onto
 * grids once per frame and then read back by bilinear interpolation.
 *
 * Sampling the noise per integration step would mean millions of 4D simplex
 * evaluations a frame; sampling a grid costs a few hundred thousand and the
 * lookups afterwards are a handful of multiplies each.
 *
 * The flow comes from the *curl* of a scalar potential rather than from the
 * noise gradient directly. Taking the curl on the grid by central differences
 * makes the sampled field discretely divergence-free, which is what closes the
 * vortices; gradient-following noise would give combed lines and no curl at all.
 */
export type Field = {
  /** Curl of the potential — the flow velocity, per grid node. */
  vx: Float32Array;
  vz: Float32Array;
  /** Surface height, per grid node. */
  height: Float32Array;
  /** Low-frequency brightness field, per grid node, in roughly [-1, 1]. */
  bright: Float32Array;
  /** Scratch potential grid, kept around so it is not reallocated per frame. */
  psi: Float32Array;
  noiseField: Noise4D;
  noiseRelief: Noise4D;
  noiseBright: Noise4D;
};

const dx = (FIELD_X1 - FIELD_X0) / (GRID_X - 1);
const dz = (FIELD_Z1 - FIELD_Z0) / (GRID_Z - 1);

export const createField = (seed: number): Field => ({
  vx: new Float32Array(GRID_X * GRID_Z),
  vz: new Float32Array(GRID_X * GRID_Z),
  height: new Float32Array(GRID_X * GRID_Z),
  bright: new Float32Array(GRID_X * GRID_Z),
  psi: new Float32Array(GRID_X * GRID_Z),
  noiseField: createNoise4D(seed),
  noiseRelief: createNoise4D(seed + 7717),
  noiseBright: createNoise4D(seed + 31337),
});

/**
 * Refill every grid for a normalised time `t` in [0, 1). The two time axes walk
 * a circle, so t = 0 and t = 1 sample identical noise and the loop closes.
 */
export const updateField = (field: Field, t: number) => {
  const theta = 2 * Math.PI * t;
  const ct = Math.cos(theta);
  const st = Math.sin(theta);

  const { psi, vx, vz, height, bright, noiseField, noiseRelief, noiseBright } =
    field;

  // Potential amplitudes: weight is a share of flow *speed*, and speed scales
  // with amplitude x frequency, so divide the weight through by frequency.
  const psiAmp = FIELD_OCTAVES.map((o) => o.weight * o.wavelength);
  const psiFreq = FIELD_OCTAVES.map((o) => 1 / o.wavelength);
  const octaves = FIELD_OCTAVES.length;

  const fw = FIELD_TIME_RADIUS;
  const rw = RELIEF_TIME_RADIUS;
  const bw = BRIGHT_TIME_RADIUS;
  const bf1 = 1 / BRIGHT_WAVELENGTH;
  const bf2 = 1 / BRIGHT_WAVELENGTH_2;

  for (let gz = 0; gz < GRID_Z; gz++) {
    const z = FIELD_Z0 + gz * dz;
    const row = gz * GRID_X;
    for (let gx = 0; gx < GRID_X; gx++) {
      const x = FIELD_X0 + gx * dx;
      const idx = row + gx;

      let p = 0;
      for (let o = 0; o < octaves; o++) {
        const f = psiFreq[o];
        p += psiAmp[o] * noiseField(x * f, z * f, ct * fw, st * fw);
      }
      psi[idx] = p;

      let h = 0;
      for (let o = 0; o < RELIEF_OCTAVES.length; o++) {
        const f = 1 / RELIEF_OCTAVES[o].wavelength;
        h +=
          RELIEF_OCTAVES[o].amplitude *
          noiseRelief(x * f, z * f, ct * rw, st * rw);
      }
      height[idx] = h;

      bright[idx] =
        noiseBright(x * bf1, z * bf1, ct * bw, st * bw) * 0.78 +
        noiseBright(x * bf2 + 40, z * bf2 - 17, ct * bw, st * bw) * 0.34;
    }
  }

  // Curl of the potential in the xz plane: v = (dpsi/dz, -dpsi/dx).
  // Central differences inside, one-sided at the border.
  for (let gz = 0; gz < GRID_Z; gz++) {
    const row = gz * GRID_X;
    const rowUp = (gz === GRID_Z - 1 ? gz : gz + 1) * GRID_X;
    const rowDn = (gz === 0 ? gz : gz - 1) * GRID_X;
    const invDz = 1 / ((gz === 0 || gz === GRID_Z - 1 ? 1 : 2) * dz);
    for (let gx = 0; gx < GRID_X; gx++) {
      const idx = row + gx;
      const iRight = row + (gx === GRID_X - 1 ? gx : gx + 1);
      const iLeft = row + (gx === 0 ? gx : gx - 1);
      const invDx = 1 / ((gx === 0 || gx === GRID_X - 1 ? 1 : 2) * dx);
      vx[idx] = (psi[rowUp + gx] - psi[rowDn + gx]) * invDz;
      vz[idx] = -(psi[iRight] - psi[iLeft]) * invDx;
    }
  }
};

/**
 * Bilinear read of a grid at world (x, z). Callers stay inside the domain by
 * construction — seeds are inset far enough that a whole life's advection
 * cannot reach the edge — so this only clamps as a safety net.
 */
export const sampleGrid = (
  grid: Float32Array,
  x: number,
  z: number,
): number => {
  let fx = (x - FIELD_X0) / dx;
  let fz = (z - FIELD_Z0) / dz;
  if (fx < 0) fx = 0;
  else if (fx > GRID_X - 1.001) fx = GRID_X - 1.001;
  if (fz < 0) fz = 0;
  else if (fz > GRID_Z - 1.001) fz = GRID_Z - 1.001;

  const ix = fx | 0;
  const iz = fz | 0;
  const tx = fx - ix;
  const tz = fz - iz;
  const r0 = iz * GRID_X + ix;
  const r1 = r0 + GRID_X;
  const a = grid[r0] + (grid[r0 + 1] - grid[r0]) * tx;
  const b = grid[r1] + (grid[r1 + 1] - grid[r1]) * tx;
  return a + (b - a) * tz;
};

export const GRID_DX = dx;
export const GRID_DZ = dz;
