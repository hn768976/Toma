/**
 * Seeded random helpers.
 *
 * Everything here funnels through Remotion's `random()`, which hashes its seed
 * rather than advancing a stream. Two consequences worth relying on: the same
 * seed string always gives the same number on any machine, and the ORDER of
 * calls does not matter — so a refactor that reorders generation is safe as
 * long as the seed strings are unchanged.
 *
 * Never use Math.random() in a Remotion composition. Frames are rendered out
 * of order across workers, and anything not derived from the seed will differ
 * between them.
 */

import { random } from "remotion";

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Seeded uniform in [min, max). */
export const rand = (seed: string, min = 0, max = 1) =>
  min + random(seed) * (max - min);

/** Seeded pick from a list. */
export const randPick = <T>(seed: string, list: readonly T[]): T =>
  list[Math.min(list.length - 1, Math.floor(random(seed) * list.length))];

/** Seeded integer in [min, max]. */
export const randInt = (seed: string, min: number, max: number) =>
  Math.min(max, min + Math.floor(random(seed) * (max - min + 1)));
