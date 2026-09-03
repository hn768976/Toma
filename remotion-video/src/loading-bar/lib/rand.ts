import { random } from "remotion";

/**
 * Deterministic random helpers built on Remotion's `random()`.
 *
 * Every value is a pure function of a stable string seed, so a frame
 * rendered on worker 3 at t=200 looks identical to the same frame
 * rendered on worker 0 during a re-render. Never use Math.random() in a
 * Remotion composition — frames are rendered out of order and in
 * parallel, and anything non-deterministic will flicker.
 */
export const seeded = (seed: string): number => random(seed);

/** Seeded value in [min, max). */
export const seededRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** Seeded value in [-spread, +spread). */
export const seededSigned = (seed: string, spread: number): number =>
  (random(seed) * 2 - 1) * spread;

/** Seeded integer in [min, maxExclusive). */
export const seededInt = (
  seed: string,
  min: number,
  maxExclusive: number,
): number => Math.floor(min + random(seed) * (maxExclusive - min));
