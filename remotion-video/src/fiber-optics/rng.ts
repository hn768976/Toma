/**
 * Seeded PRNG. Every random-looking value in the scene comes from here so that
 * a given seed always builds the exact same geometry — Remotion renders frames
 * out of order and across processes, so nothing may depend on Math.random().
 */
export const createRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = ReturnType<typeof createRng>;

/** Uniform float in [min, max). */
export const range = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);
