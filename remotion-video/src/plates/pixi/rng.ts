// Deterministic randomness + value noise.
//
// Rendering a video frame-by-frame means the same frame may be drawn more than
// once (studio scrubbing, render retries, the 4K pass). Nothing in a plate may
// call Math.random() at draw time -- all scatter is baked once from a seed.

/** mulberry32: small, fast, well-distributed 32-bit PRNG. */
export const makeRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Random = ReturnType<typeof makeRandom>;

/** Uniform float in [min, max). */
export const between = (rnd: Random, min: number, max: number) =>
  min + rnd() * (max - min);

/** Biased towards `min` when power > 1, towards `max` when power < 1. */
export const betweenBiased = (
  rnd: Random,
  min: number,
  max: number,
  power: number,
) => min + Math.pow(rnd(), power) * (max - min);

const TAU = Math.PI * 2;

/**
 * 1D value noise that is *exactly* periodic over `period` samples, so a plate
 * built on it loops seamlessly. Hash wraps with a modulo on the cell index.
 */
const hash1 = (i: number, seed: number) => {
  let h = Math.imul(i ^ seed, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

const smoothstep = (t: number) => t * t * (3 - 2 * t);

export const periodicNoise1D = (x: number, period: number, seed: number) => {
  const p = Math.max(1, Math.round(period));
  const xi = Math.floor(x);
  const xf = x - xi;
  const a = hash1(((xi % p) + p) % p, seed);
  const b = hash1(((xi + 1) % p + p) % p, seed);
  return a + (b - a) * smoothstep(xf);
};

/** Summed octaves of the periodic noise above; still perfectly periodic. */
export const periodicFbm1D = (
  x: number,
  period: number,
  seed: number,
  octaves = 3,
) => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * periodicNoise1D(x * freq, period * freq, seed + o * 7919);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
};

/**
 * A looping oscillator: `harmonic` full cycles across the clip, offset by
 * `phase` turns. Returns [-1, 1].
 */
export const loopWave = (u: number, harmonic: number, phase: number) =>
  Math.sin(TAU * (harmonic * u + phase));

/** Same, but mapped to [0, 1]. */
export const loopWave01 = (u: number, harmonic: number, phase: number) =>
  0.5 + 0.5 * loopWave(u, harmonic, phase);

export { TAU };
