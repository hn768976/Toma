/** Deterministic PRNG so every render of a given seed is byte-identical. */

export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, maxInclusive: number) => number;
  pick: <T>(items: readonly T[]) => T;
};

export const makeRng = (seed: number): Rng => {
  const next = mulberry32(seed);
  const range = (min: number, max: number) => min + (max - min) * next();
  return {
    next,
    range,
    int: (min, maxInclusive) =>
      Math.floor(min + (maxInclusive - min + 1) * next()),
    pick: (items) => items[Math.floor(next() * items.length) % items.length],
  };
};
