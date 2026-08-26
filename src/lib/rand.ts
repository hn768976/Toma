import {random} from 'remotion';

/**
 * Every value in this piece comes from Remotion's `random()` with a stable
 * string seed, so `npx remotion render` is bit-for-bit deterministic.
 * Math.random() is never used.
 */
export const rnd = (seed: string): number => random(seed);

export const rndRange = (seed: string, a: number, b: number): number =>
  a + random(seed) * (b - a);

/** Inclusive integer in [a, b]. */
export const rndInt = (seed: string, a: number, b: number): number =>
  Math.min(b, a + Math.floor(random(seed) * (b - a + 1)));

/** Symmetric value in [-m, m]. */
export const rndSigned = (seed: string, m: number): number =>
  (random(seed) * 2 - 1) * m;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
