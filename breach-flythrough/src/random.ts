/**
 * Deterministic, seedable PRNG. Every layer, block, token and position in the
 * scene is derived from one of these, so the whole composition is a pure
 * function of the frame number and nothing is carried between frames.
 */

const hashString = (seed: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export type Rng = {
  /** Uniform in [0, 1). */
  next: () => number;
  /** Uniform in [min, max). */
  range: (min: number, max: number) => number;
  /** Integer in [min, max]. */
  int: (min: number, max: number) => number;
  /** Uniformly picks one entry. */
  pick: <T>(items: readonly T[]) => T;
  /** True with the given probability. */
  chance: (probability: number) => boolean;
};

/** mulberry32 — small, fast and stable across Node and the browser. */
export const makeRng = (seed: string): Rng => {
  let a = hashString(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (min: number, max: number) => min + next() * (max - min);
  return {
    next,
    range,
    int: (min, max) => Math.floor(range(min, max + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (probability) => next() < probability,
  };
};
