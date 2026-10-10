// Seeded PRNG. Every generator in this project is created at module level
// (or from a fixed seed inside a memo), never from Math.random(), so a
// frame rendered on its own matches the same frame inside a full render.
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

export type Rng = () => number;

export const range = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();
export const irange = (rng: Rng, lo: number, hi: number) =>
  Math.floor(lo + (hi - lo + 1) * rng());
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

// Integer hash -> [0,1). Used for per-pixel grain/dither in Canvas 2D.
export const hash3 = (x: number, y: number, z: number) => {
  let h = Math.imul(x | 0, 0x8da6b343) ^ Math.imul(y | 0, 0xd8163841) ^ Math.imul(z | 0, 0xcb1ab31f);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
