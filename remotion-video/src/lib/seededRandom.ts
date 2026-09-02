// Vendored from remotion-lib (~/projects/remotion-lib/src).
// Do not edit here: change it in the library and re-run
// `node scripts/sync-lib.mjs`. Copied in so this project renders standalone.
import { random } from "remotion";

/**
 * Seeded random helpers. Everything in the piece — clipping sizes, tear
 * shapes, word lengths, bob phases — is derived from a stable string seed so
 * that a render is byte-identical no matter which worker draws which frame.
 */

/** Uniform value in [min, max). */
export const rndRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** Integer in [min, maxExclusive). */
export const rndInt = (seed: string, min: number, maxExclusive: number): number =>
  Math.min(maxExclusive - 1, Math.floor(rndRange(seed, min, maxExclusive)));

/** Deterministic pick from a list. */
export const rndPick = <T>(seed: string, items: T[]): T =>
  items[rndInt(seed, 0, items.length)];

/** True with the given probability. */
export const rndChance = (seed: string, probability: number): boolean =>
  random(seed) < probability;

/**
 * A fast counter-based PRNG (mulberry32) used only where we need tens of
 * thousands of values per bake — per-pixel paper speckle and grain tiles.
 * Calling random() with a fresh string for every pixel would be needlessly
 * slow, so the *seed* comes from Remotion's random() and the stream from
 * there on is a pure integer recurrence. It never touches Math.random(), so
 * the result is still identical on every render.
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

/** A mulberry32 stream whose seed is derived from a stable string. */
export const seededStream = (seed: string): (() => number) =>
  mulberry32(Math.floor(random(seed) * 4294967296));
