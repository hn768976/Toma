/**
 * Seeded PRNG. Every procedural decision in this project (trace layout,
 * binary content, brain node placement, shimmer phases, grain) runs through
 * one of these so the output is byte-identical on any machine and on any
 * render thread.
 */
export type Rng = () => number;

export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Uniform float in [min, max). */
export const range = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);

/** Uniform integer in [min, max]. */
export const rangeInt = (rng: Rng, min: number, max: number) =>
  Math.floor(min + rng() * (max - min + 1));

export const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

/** Deterministic hash of an integer to [0,1). Handy for per-index phases. */
export const hash1 = (i: number) => {
  let t = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  t ^= t >>> 13;
  t = Math.imul(t, 0xc2b2ae35);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
};
