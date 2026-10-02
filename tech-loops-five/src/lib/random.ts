/**
 * Deterministic randomness. Nothing in this project calls Math.random():
 * - mulberry32 is seeded at MODULE level to build static layouts/schedules,
 * - hash*() are pure integer hashes used for per-frame values.
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

/** 32-bit integer hash of up to three ints (lowbias32-style mixing). */
export const hashU32 = (a: number, b = 0, c = 0): number => {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
};

/** Hash → float in [0, 1). */
export const hash01 = (a: number, b = 0, c = 0) => hashU32(a, b, c) / 4294967296;

/** Seeded picker helpers for module-level construction. */
export const pick = <T,>(rnd: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rnd() * arr.length) % arr.length];
