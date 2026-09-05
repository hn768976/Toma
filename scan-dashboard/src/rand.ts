/**
 * Deterministic pseudo-randomness.
 *
 * Layout and per-module seeds are drawn once at module scope so that every
 * frame — and every render — sees exactly the same dashboard.
 */

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

export type Rng = () => number;

export const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
export const intBetween = (rng: Rng, min: number, max: number) =>
  Math.floor(between(rng, min, max + 1 - 1e-9));
export const pick = <T,>(rng: Rng, items: readonly T[]): T => items[intBetween(rng, 0, items.length - 1)];
