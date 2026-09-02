/**
 * Deterministic randomness.
 *
 * Wraps Remotion's random() so that every value is a pure function of a stable
 * string seed. Remotion renders frames out of order across workers, so
 * Math.random() would make the piece non-reproducible; these helpers make it
 * impossible to reach for it by accident.
 */

import { random } from "remotion";

/** Uniform in [0, 1). */
export const rand01 = (seed: string): number => random(seed);

/** Uniform in [min, max). */
export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** Uniform integer in [min, max] inclusive. */
export const randInt = (seed: string, min: number, max: number): number =>
  min + Math.floor(random(seed) * (max - min + 1 - 1e-9));

/** Uniform in [-spread, spread). */
export const randSigned = (seed: string, spread: number): number =>
  (random(seed) * 2 - 1) * spread;

/** Picks an element of `items` deterministically. */
export const randPick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];
