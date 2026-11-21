/**
 * Seeded PRNG. Every "random" value in this project comes from here, seeded at
 * module level, so a frame rendered on its own is identical to the same frame
 * inside a full render. Math.random() is never used.
 */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const range = (rnd: () => number, lo: number, hi: number) =>
  lo + (hi - lo) * rnd();
