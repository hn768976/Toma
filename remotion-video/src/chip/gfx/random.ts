// Deterministic PRNG. Remotion renders frames out of order and across several
// browser tabs, so every piece of "randomness" in the scene has to be a pure
// function of a seed rather than Math.random().

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = () => number;

export const rangeFrom = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);

export const pick = <T,>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
