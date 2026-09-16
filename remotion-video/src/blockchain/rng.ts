// Deterministic PRNG. Every random value in the scene is drawn from a
// seeded stream so a given frame renders byte-identically on every
// machine -- Remotion renders frames out of order and across several
// browser tabs, so Math.random() would produce a flickering mess.

export const makeRandom = (seed: number) => {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Random = ReturnType<typeof makeRandom>;

export const range = (random: Random, min: number, max: number) =>
  min + random() * (max - min);
