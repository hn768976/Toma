/**
 * Scene layout has to be identical on every frame and in every process, so the
 * yards are built from an explicit seeded stream rather than Math.random().
 */

export type Rng = {
  /** Uniform in [0, 1). */
  next(): number;
  float(min: number, max: number): number;
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  /** True with probability p. */
  chance(p: number): boolean;
};

/** mulberry32 — small, fast, and good enough for layout noise. */
export const createRng = (seed: number): Rng => {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
  };
};
