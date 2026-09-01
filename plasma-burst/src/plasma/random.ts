import { random } from "remotion";

/**
 * All randomness in the piece goes through Remotion's `random()` with stable
 * seeds, never `Math.random()`, so every frame is a pure function of the frame
 * number and `npx remotion render` is deterministic across workers.
 */

export const TAU = Math.PI * 2;

export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** Symmetric about zero: -amp..+amp. */
export const randSigned = (seed: string, amp: number): number =>
  (random(seed) * 2 - 1) * amp;

export const randInt = (seed: string, min: number, maxExclusive: number): number =>
  min + Math.floor(random(seed) * (maxExclusive - min));

export const chance = (seed: string, probability: number): boolean =>
  random(seed) < probability;

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
