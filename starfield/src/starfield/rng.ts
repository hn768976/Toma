/**
 * Deterministic pseudo-randomness.
 *
 * Everything in this project that "looks random" comes from here, seeded from a
 * composition prop. Nothing calls Math.random() at render time, so frame N is
 * byte-identical on every machine and on every re-render.
 */

/** Bob Jenkins' 32-bit integer hash — turns a string/number into a usable seed. */
export const hashSeed = (input: string | number): number => {
  const str = String(input);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

/** mulberry32 — small, fast, well-distributed 32-bit PRNG. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const makeRng = (seed: string | number) => mulberry32(hashSeed(seed));

/** Uniform in [min, max). */
export const range = (rng: () => number, min: number, max: number): number =>
  min + rng() * (max - min);

/**
 * Approximately normal, mean 0, sd 1 (sum of 3 uniforms, cheap and bounded).
 * Bounded output matters here: a true Gaussian tail would occasionally produce
 * a grain pixel bright enough to read as a hot pixel.
 */
export const gauss = (rng: () => number): number =>
  (rng() + rng() + rng() - 1.5) * 2;

/** Pick an index from a weight table that sums to 1. */
export const pickWeighted = (rng: () => number, weights: number[]): number => {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r < acc) return i;
  }
  return weights.length - 1;
};
