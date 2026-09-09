/**
 * Deterministic PRNG. Remotion renders frames out of order across threads, so
 * nothing may call Math.random() at render time -- every value in the piece has
 * to be a pure function of the frame number and of constants seeded here, at
 * module scope.
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

export const range = (rnd: () => number, min: number, max: number) =>
  min + rnd() * (max - min);
