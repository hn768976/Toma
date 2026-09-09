/**
 * Seeded PRNG. Placement of bokeh, ghost tiles and ribbons must be identical
 * on every frame and in every render thread, so nothing here may touch
 * Math.random().
 */

const hashString = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** mulberry32 — small, fast, good enough for scatter. */
export const makeRandom = (seed: string): (() => number) => {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Uniform in [min, max). */
export const range = (rng: () => number, min: number, max: number): number =>
  min + rng() * (max - min);
