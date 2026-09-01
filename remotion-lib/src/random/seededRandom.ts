/**
 * Seeded randomness.
 *
 * WHAT: A mulberry32 PRNG plus small helpers for drawing numbers, integers,
 * signs and array picks from it.
 *
 * WHY: Remotion renders frames out of order and across worker processes.
 * Anything that is not a pure function of (seed, frame) will pop between
 * frames. `Math.random()` is therefore never acceptable inside a composition.
 *
 * Remotion's own `random(seed)` hashes a string per call, which is right for a
 * handful of values but far too slow when you need one value per pixel — a
 * 1920x1080 grain tile is two million hashes. The pattern used throughout the
 * source projects, and preserved here, is to call Remotion's `random()` ONCE
 * to derive an integer seed and then pull every subsequent value from
 * `mulberry32`, which is a few arithmetic ops per value.
 *
 * PARAMETERS
 *   seed  An integer. Any bit pattern is fine; it is coerced with `| 0`.
 *
 * EXAMPLE
 *   import { random } from 'remotion';
 *   import { mulberry32, between } from 'remotion-lib/random';
 *
 *   const rng = mulberry32(seedFrom(random('stars')));
 *   const x = between(rng, 0, 1920);
 */
import type { Rng } from '../types';

/**
 * A tiny, fast, deterministic PRNG.
 *
 * Identical output for identical seeds on every machine and every render.
 * Period is 2^32, which is ample for per-frame scatter and grain.
 */
export const mulberry32 = (seed: number): Rng => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Turns a [0, 1) float — typically Remotion's `random(someString)` — into an
 * integer seed suitable for `mulberry32`.
 *
 * Kept separate so the library never has to import from `remotion` itself,
 * which keeps every module here testable in plain Node.
 */
export const seedFrom = (unitValue: number): number =>
  Math.floor(unitValue * 0xffffffff) | 0;

/** Uniform value in [min, max). */
export const between = (rng: Rng, min: number, max: number): number =>
  min + rng() * (max - min);

/** Uniform integer in [min, max] — both ends inclusive. */
export const intBetween = (rng: Rng, min: number, max: number): number =>
  Math.floor(min + rng() * (max - min + 1));

/** -1 or +1, each with probability 0.5. */
export const sign = (rng: Rng): number => (rng() < 0.5 ? -1 : 1);

/** True with the given probability. */
export const chance = (rng: Rng, probability: number): boolean =>
  rng() < probability;

/** A uniformly chosen element. Throws on an empty array rather than returning undefined. */
export const pick = <T>(rng: Rng, items: readonly T[]): T => {
  if (items.length === 0) throw new Error('pick() called with an empty array');
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
};

/**
 * A seeded Fisher-Yates shuffle. Returns a new array; the input is untouched,
 * so this stays safe to call on module-level constants.
 */
export const shuffled = <T>(rng: Rng, items: readonly T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
