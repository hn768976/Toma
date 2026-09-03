/**
 * Deterministic randomness helpers.
 *
 * Everything in this project must be a pure function of (identity, frame) so
 * that `npx remotion render` — which renders frames out of order across
 * several worker browsers — produces the same pixels every time. That rules
 * out Math.random(); all identity randomness goes through Remotion's
 * `random()`, which hashes a stable string seed.
 */
import { random } from "remotion";

/** Uniform in [0, 1). */
export const rnd = (seed: string): number => random(seed);

/** Uniform in [min, max). */
export const rndRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** Uniform integer in [min, max], both inclusive. */
export const rndInt = (seed: string, min: number, max: number): number =>
  min + Math.floor(random(seed) * (max - min + 1));

/** True with probability `p`. */
export const rndBool = (seed: string, p: number): boolean => random(seed) < p;

/** -1 or +1. */
export const rndSign = (seed: string): number => (random(seed) < 0.5 ? -1 : 1);

/** Uniform choice from a non-empty list. */
export const rndPick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

/**
 * Roughly bell-shaped in [-1, 1] (mean 0). Averaging three uniforms is the
 * cheap Irwin-Hall trick; used where clustering around a centre looks more
 * natural than a flat spread (scratch positions, size jitter).
 */
export const rndBell = (seed: string): number =>
  ((random(seed + "|b0") + random(seed + "|b1") + random(seed + "|b2")) / 3) * 2 - 1;

/**
 * A fast integer LCG for per-pixel work, where calling random() millions of
 * times per frame would be far too slow. Seed it from a single random() call
 * so the stream is still deterministic in the frame number.
 *
 * Returns a function producing a byte in [0, 255].
 */
export const makeByteLcg = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s >>> 24) & 255;
  };
};

/** Turns a string seed into a 32-bit integer suitable for makeByteLcg. */
export const lcgSeedFrom = (seed: string): number =>
  Math.floor(random(seed) * 4294967296) >>> 0;
