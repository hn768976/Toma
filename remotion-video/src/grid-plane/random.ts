// Small deterministic RNG. Rendering is distributed across many Chrome
// instances, so every value that varies per particle/panel must come from a
// seed rather than Math.random() or frames will not match.

/** Mulberry32. Returns a generator producing floats in [0, 1). */
export const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Stable hash of an integer pair, in [0, 1). Handy for per-grid-line values. */
export const hash2 = (a: number, b: number): number => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
