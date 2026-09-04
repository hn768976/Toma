/** mulberry32 — small, fast, fully deterministic PRNG. */
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

/**
 * Stateless integer hash -> [0, 1). Used for anything that must be a pure
 * function of (tower, row, col, epoch): Remotion renders frames out of order
 * across threads, so nothing may depend on evaluation order.
 */
export const hash4 = (a: number, b: number, c: number, d: number) => {
  let h = 0x9e3779b9 ^ Math.imul(a | 0, 0x85ebca6b);
  h = Math.imul(h ^ (b | 0), 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h ^ (c | 0), 0x27d4eb2f);
  h ^= h >>> 13;
  h = Math.imul(h ^ (d | 0), 0x165667b1);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export const pick = <T,>(rand: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rand() * arr.length) % arr.length];

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const range = (rand: () => number, min: number, max: number) =>
  min + rand() * (max - min);
