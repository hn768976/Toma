/**
 * Deterministic PRNG. Seeded at module level; every value the scenes need is
 * drawn once at build time, never at render time. See DETERMINISM in README.
 */
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

/** Uniform draw in [min, max). */
export const range = (rnd: () => number, min: number, max: number): number =>
  min + rnd() * (max - min);

/** Pick one element. */
export const pick = <T,>(rnd: () => number, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rnd() * items.length))];
