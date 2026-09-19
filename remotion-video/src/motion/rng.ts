/**
 * Deterministic PRNG (mulberry32).
 *
 * Scenes must look identical on every render and at every resolution, so all
 * randomness is seeded here rather than taken from Math.random().
 */
export const createRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Uniform float in [min, max). */
export const range = (rng: () => number, min: number, max: number) =>
  min + rng() * (max - min);

/** Uniform integer in [min, max]. */
export const rangeInt = (rng: () => number, min: number, max: number) =>
  Math.floor(min + rng() * (max - min + 1));

/** Picks one element deterministically. */
export const pick = <T,>(rng: () => number, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
