/**
 * Deterministic randomness helpers built on Remotion's `random()`.
 *
 * Every value that looks random should be derived from a stable string seed,
 * so a frame rendered on worker 3 of a `remotion render` is byte-identical to
 * the same frame in the Studio. Math.random() and Date.now() are never used.
 */
import { random } from "remotion";

/** Uniform in [0, 1). */
export const rand01 = (seed: string): number => random(seed);

/** Uniform in [min, max). */
export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** Integer in [min, maxExclusive). */
export const randInt = (
  seed: string,
  min: number,
  maxExclusive: number,
): number => min + Math.floor(random(seed) * (maxExclusive - min));

/** A stable pick from a list. */
export const randPick = <T>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

/**
 * A cheap integer PRNG (mulberry32) for bulk generation — noise tiles and the
 * like — where calling `random()` a million times with string seeds would be
 * needlessly slow. Always seed it from `random()` so the result stays
 * deterministic and Math.random() never enters the picture.
 */
export const mulberry32 = (seed: number): (() => number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A mulberry32 stream whose seed is itself derived from a stable string. */
export const seededStream = (seed: string): (() => number) =>
  mulberry32(Math.floor(random(seed) * 0xffffffff));

/**
 * Picks a value that divides `total` exactly, so anything driven by it
 * completes a whole number of cycles per loop. Used for pulse periods and
 * glyph reroll cadences.
 */
export const DIVISORS_OF_360 = [
  2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90, 120,
  180, 360,
] as const;
