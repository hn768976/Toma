/**
 * Deterministic RNG so every render of a given seed produces the same board.
 * mulberry32 — small, fast, good enough for layout scatter.
 */
export const createRng = (seed: number) => {
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
    range: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, maxExclusive: number) =>
      min + Math.floor(next() * (maxExclusive - min)),
    pick: <T>(items: readonly T[]): T =>
      items[Math.min(items.length - 1, Math.floor(next() * items.length))],
    chance: (probability: number) => next() < probability,
  };
};

export type Rng = ReturnType<typeof createRng>;
