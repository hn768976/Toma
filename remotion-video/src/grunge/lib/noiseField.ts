/**
 * Seeded, tileable 2D value noise.
 *
 * The lattice is generated once (from Remotion's random(), so it is stable
 * across renders) and sampling is pure arithmetic afterwards — important
 * because the grain layer samples a density field tens of thousands of times
 * per frame and could not afford a string-hashed PRNG call per sample.
 *
 * The lattice wraps in both axes, so translating the sample point by a whole
 * number of grid cells returns the identical field. That is what lets a
 * drifting noise field close a loop exactly: drift the sample origin by an
 * integer number of cells over the loop length and frame N == frame 0.
 */
import { rnd } from "./rng";

export type NoiseField = {
  gridW: number;
  gridH: number;
  /** Samples the field at grid coordinates (wraps). Returns 0..1. */
  sample: (x: number, y: number) => number;
};

const fade = (t: number): number => t * t * (3 - 2 * t);

export const createNoiseField = (
  seed: string,
  gridW: number,
  gridH: number,
): NoiseField => {
  const values = new Float32Array(gridW * gridH);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      values[y * gridW + x] = rnd(seed + "|" + x + "," + y);
    }
  }

  const sample = (x: number, y: number): number => {
    // Positive modulo so negative sample coordinates still wrap correctly.
    const fx = ((x % gridW) + gridW) % gridW;
    const fy = ((y % gridH) + gridH) % gridH;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = (x0 + 1) % gridW;
    const y1 = (y0 + 1) % gridH;
    const tx = fade(fx - x0);
    const ty = fade(fy - y0);
    const v00 = values[y0 * gridW + x0];
    const v10 = values[y0 * gridW + x1];
    const v01 = values[y1 * gridW + x0];
    const v11 = values[y1 * gridW + x1];
    const top = v00 + (v10 - v00) * tx;
    const bottom = v01 + (v11 - v01) * tx;
    return top + (bottom - top) * ty;
  };

  return { gridW, gridH, sample };
};

/**
 * Two octaves of the above, for fields that want a little more structure
 * (grain density, scratch brightness) without the cost of a full fBm.
 */
export const createOctaveNoiseField = (
  seed: string,
  gridW: number,
  gridH: number,
): NoiseField => {
  const coarse = createNoiseField(seed + "|o0", gridW, gridH);
  const fine = createNoiseField(seed + "|o1", gridW * 2, gridH * 2);
  return {
    gridW,
    gridH,
    sample: (x, y) => coarse.sample(x, y) * 0.68 + fine.sample(x * 2, y * 2) * 0.32,
  };
};

/**
 * Seeded 1D value noise over an arbitrary domain length, used for brightness
 * variation along a scratch. `cells` controls the feature size.
 */
export const createNoise1D = (
  seed: string,
  cells: number,
): ((t: number) => number) => {
  const values = new Float32Array(cells);
  for (let i = 0; i < cells; i++) values[i] = rnd(seed + "|1d" + i);
  return (t: number) => {
    const f = ((t % cells) + cells) % cells;
    const i0 = Math.floor(f);
    const i1 = (i0 + 1) % cells;
    const k = fade(f - i0);
    return values[i0] + (values[i1] - values[i0]) * k;
  };
};
