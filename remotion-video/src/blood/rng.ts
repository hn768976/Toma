/**
 * Deterministic pseudo-random numbers.
 *
 * Every cell, mote and wobble phase in the bloodstream scenes is derived from a
 * seed, so a given frame always renders identically — which is what makes
 * distributed / resumed Remotion renders stitch together without popping.
 */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = ReturnType<typeof mulberry32>;

export const range = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);
