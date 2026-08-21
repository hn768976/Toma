/**
 * Deterministic PRNG. Seeded once, consumed once, at module scope — so every
 * render worker builds byte-identical streak parameters. Never call
 * Math.random() anywhere in this project.
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

/** Uniform in [min, max). */
export const range = (rng: () => number, min: number, max: number): number =>
  min + rng() * (max - min);

/** Pick one element deterministically. */
export const pick = <T,>(rng: () => number, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length) % items.length];

/** Uniform in [min, max) biased toward `min` when power > 1. */
export const biased = (
  rng: () => number,
  min: number,
  max: number,
  power: number,
): number => min + Math.pow(rng(), power) * (max - min);
