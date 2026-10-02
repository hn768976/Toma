// Deterministic randomness. Everything that *looks* random is drawn from a
// seeded mulberry32 when a module is first evaluated (never at render time),
// or from `hash01`, a pure function of integers such as (cell, frame).

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

export type Rng = ReturnType<typeof mulberry32>;

export const range = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);
export const int = (rng: Rng, min: number, maxInclusive: number) =>
  Math.floor(range(rng, min, maxInclusive + 1));
export const pick = <T,>(rng: Rng, list: readonly T[]): T =>
  list[Math.floor(rng() * list.length)];

// Integer hash -> [0, 1). Pure, so safe to call per frame.
export const hash01 = (a: number, b = 0, c = 0): number => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ Math.imul(c | 0, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export const clamp = (v: number, lo = 0, hi = 1) =>
  Math.min(hi, Math.max(lo, v));
