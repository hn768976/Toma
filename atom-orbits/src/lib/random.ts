/**
 * Seeded PRNG. Every random-looking value in the project (orbit tilts, nucleus
 * sphere positions, strand offsets, stars, bokeh paths) comes from one of these,
 * created at module level, so the scene is identical on every render thread.
 * Never use Math.random() anywhere in this project.
 */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = ReturnType<typeof mulberry32>;

export const range = (rng: Rng, min: number, max: number) =>
  min + (max - min) * rng();

/** Whole number in [min, max] inclusive. */
export const int = (rng: Rng, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));

export const sign = (rng: Rng) => (rng() < 0.5 ? -1 : 1);
