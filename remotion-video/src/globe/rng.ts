/**
 * mulberry32 — small, fast, seedable PRNG. Every random value in the
 * scene comes from here so each frame of a render is reproducible and
 * the two versions stay in sync structurally.
 */
export const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = <T,>(rng: () => number, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length) % items.length];

export const range = (rng: () => number, min: number, max: number) =>
  min + rng() * (max - min);
