// Vendored from remotion-lib (~/projects/remotion-lib/src).
// Do not edit here: change it in the library and re-run
// `node scripts/sync-lib.mjs`. Copied in so this project renders standalone.
import { random } from "remotion";

/**
 * Seeded value-noise fields.
 *
 * Both fields wrap on their lattice size, which is what lets the wall tile
 * horizontally without a visible seam: sampling x and x + latticeWidth gives
 * the same value.
 */

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

export type Noise1D = {
  size: number;
  values: Float32Array;
};

export const makeNoise1D = (seed: string, size = 256): Noise1D => {
  const values = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    values[i] = random(`${seed}:${i}`);
  }
  return { size, values };
};

/** Sample at lattice coordinate x (wraps). Returns 0..1. */
export const sampleNoise1D = (n: Noise1D, x: number): number => {
  const i = Math.floor(x);
  const f = x - i;
  const a = n.values[((i % n.size) + n.size) % n.size];
  const b = n.values[((i + 1) % n.size + n.size) % n.size];
  return a + (b - a) * smoothstep(f);
};

export type Noise2D = {
  w: number;
  h: number;
  values: Float32Array;
};

export const makeNoise2D = (seed: string, w: number, h: number): Noise2D => {
  const values = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      values[y * w + x] = random(`${seed}:${x}:${y}`);
    }
  }
  return { w, h, values };
};

/** Bilinear sample at lattice coordinates (wraps on both axes). Returns 0..1. */
export const sampleNoise2D = (n: Noise2D, x: number, y: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smoothstep(x - xi);
  const fy = smoothstep(y - yi);
  const x0 = ((xi % n.w) + n.w) % n.w;
  const y0 = ((yi % n.h) + n.h) % n.h;
  const x1 = (x0 + 1) % n.w;
  const y1 = (y0 + 1) % n.h;
  const v00 = n.values[y0 * n.w + x0];
  const v10 = n.values[y0 * n.w + x1];
  const v01 = n.values[y1 * n.w + x0];
  const v11 = n.values[y1 * n.w + x1];
  const top = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return top + (bottom - top) * fy;
};

export type NoiseField = {
  /** Sample at normalised coordinates; sx/sy set how many lattice cells the
   *  0..1 range spans, so they act as frequencies. */
  sample: (x: number, y: number) => number;
};

/**
 * A fractal (multi-octave) 2D field. `aspect` lets the field be stretched —
 * an aspect far below 1 gives long vertical streaks, which is how the wall
 * gets its brushed quality.
 */
export const noiseField = (opts: {
  seed: string;
  octaves?: number;
  latticeW?: number;
  latticeH?: number;
  /** Vertical frequency multiplier. < 1 stretches the field vertically. */
  aspect?: number;
  /** Amplitude falloff per octave. */
  persistence?: number;
}): NoiseField => {
  const octaves = opts.octaves ?? 3;
  const latticeW = opts.latticeW ?? 64;
  const latticeH = opts.latticeH ?? 64;
  const aspect = opts.aspect ?? 1;
  const persistence = opts.persistence ?? 0.5;

  const layers: Noise2D[] = [];
  for (let o = 0; o < octaves; o++) {
    layers.push(makeNoise2D(`${opts.seed}:oct${o}`, latticeW, latticeH));
  }

  return {
    sample: (x: number, y: number) => {
      let total = 0;
      let amplitude = 1;
      let norm = 0;
      let freq = 1;
      for (let o = 0; o < octaves; o++) {
        total += sampleNoise2D(layers[o], x * freq, y * aspect * freq) * amplitude;
        norm += amplitude;
        amplitude *= persistence;
        freq *= 2;
      }
      return total / norm;
    },
  };
};
