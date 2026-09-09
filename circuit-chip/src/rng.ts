// Deterministic PRNG (mulberry32). The whole board is generated from this at
// module level, so every frame — rendered on any thread, in any order —
// sees identical geometry.
export type Rng = {
  next: () => number;
  range: (lo: number, hi: number) => number;
  int: (lo: number, hi: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (p: number) => boolean;
};

export const makeRng = (seed: number): Rng => {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (lo: number, hi: number) => lo + next() * (hi - lo);
  const int = (lo: number, hi: number) => Math.floor(range(lo, hi + 1 - 1e-9));
  return {
    next,
    range,
    int,
    pick: <T,>(items: readonly T[]) => items[int(0, items.length - 1)],
    chance: (p: number) => next() < p,
  };
};
