/**
 * Deterministic PRNG. Every render — preview, 4K, or a re-render six months
 * from now — must produce byte-identical geometry, so nothing in this project
 * ever calls Math.random().
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

/** Hash a small integer tuple to [0, 1). Used for per-cell decisions. */
export const hash2 = (x: number, y: number, seed: number) => {
  let h = seed ^ Math.imul(x | 0, 0x27d4eb2d);
  h = Math.imul(h ^ (y | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
