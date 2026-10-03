/**
 * Deterministic randomness. Everything random in this project is either a
 * mulberry32 stream seeded at module level, or a pure integer hash of
 * (inputs). Never Math.random().
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

/** Integer hash (lowbias32). Pure function of its inputs. */
export const hashU32 = (x: number) => {
  let h = x >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
};

/** Hash of up to three integers to [0, 1). */
export const hash01 = (a: number, b = 0, c = 0) =>
  hashU32(hashU32(hashU32(a | 0) ^ (b | 0)) ^ Math.imul(c | 0, 0x9e3779b1)) /
  4294967296;

/** Helpers over a mulberry32 stream. */
export const makeRng = (seed: number) => {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (a: number, b: number) => a + (b - a) * r(),
    int: (a: number, b: number) => Math.floor(a + (b - a + 1) * r()),
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)],
    chance: (p: number) => r() < p,
  };
};
