/**
 * Deterministic randomness. Layout generators seed mulberry32 at module level
 * (or from a fixed seed) so layouts are identical in every render thread.
 * Never call Math.random() anywhere in this project.
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

export const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
export const irange = (rng: Rng, a: number, b: number) =>
  Math.floor(a + (b - a + 1) * rng());

/** Stateless integer hash -> [0,1). Same answer every call, every thread. */
export const hash1 = (...xs: number[]) => {
  let h = 0x811c9dc5;
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};
