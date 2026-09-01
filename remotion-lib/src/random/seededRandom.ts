/**
 * seededRandom.ts — deterministic pseudo-randomness for Remotion.
 *
 * WHAT IT DOES
 *   Wraps a mulberry32 PRNG so that any visual "identity" (a particle's
 *   angle, a dash's length, a branch's kink) is a pure function of an
 *   integer index and a salt, never of Math.random() or Date.now().
 *
 * WHAT IT IS FOR
 *   Remotion renders frames out of order across parallel workers. A value
 *   drawn from Math.random() therefore differs between frame 40 and frame
 *   41, which reads on screen as popping, flicker, or a particle field
 *   that boils. Deriving every value from (index, salt) instead makes the
 *   same element identical on every frame and in every worker.
 *
 * WHY NOT REMOTION'S random()
 *   Remotion ships random(seed), which is fine for one-off draws. These
 *   wrappers add the two things this library needs constantly: a
 *   *stream* (makeRng) for helpers that take many draws in a loop, and a
 *   two-axis (index, salt) addressing scheme so one element can carry a
 *   dozen independent attributes without them correlating. Salt values
 *   should be spaced (10, 20, 30...) because adjacent salts on a shared
 *   index are adjacent in the state space and can visibly correlate.
 *
 * PARAMETERS
 *   seed    integer; the whole stream is a function of this
 *   index   integer; which element you are asking about
 *   salt    integer; which attribute of that element
 *
 * USAGE
 *   const rng = makeRng(1234);
 *   const jitter = rng() * 10;                    // stream
 *   const size = 2 + seededRandom(i, 20) * 3;     // addressed
 */

import type { Rng } from "../types";

/**
 * mulberry32: a 32-bit PRNG that is fast, dependency-free and has a long
 * enough period for any per-frame particle work. Returns a stateful
 * closure — call it repeatedly for successive uniform floats in [0, 1).
 *
 * The closure IS stateful, which looks like it contradicts the library's
 * purity rule. It does not: the state lives entirely inside one call and
 * is fully determined by `seed`, so the sequence a caller observes is
 * reproducible. Never hoist an Rng into module scope or a React ref —
 * that is what would make output frame-order dependent.
 */
export const makeRng = (seed: number): Rng => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * A single addressed draw. `seededRandom(i, 20)` always returns the same
 * float for the same (i, 20), so it can be called inside a render without
 * threading an Rng through. The multipliers are large co-prime-ish
 * constants that decorrelate neighbouring index/salt pairs.
 */
export const seededRandom = (index: number, salt: number): number => {
  const rand = makeRng(index * 9781 + salt * 6151 + 1);
  return rand();
};

/** An addressed draw mapped onto [min, max). */
export const seededRange = (
  index: number,
  salt: number,
  min: number,
  max: number,
): number => min + seededRandom(index, salt) * (max - min);

/**
 * Approximates a bell curve on [-1, 1] by averaging three uniform draws
 * (an Irwin–Hall sample). Use where values should cluster around a centre
 * rather than spread flat: particle radius within a band, size variation,
 * the wander of a hand-drawn line. Consumes salts `salt`, `salt+1` and
 * `salt+2`, so leave a gap of at least 3 before the next attribute.
 */
export const seededGaussian = (index: number, salt: number): number => {
  const a = seededRandom(index, salt);
  const b = seededRandom(index, salt + 1);
  const c = seededRandom(index, salt + 2);
  return ((a + b + c) / 3 - 0.5) * 2;
};

/**
 * Turns a string into a stable integer seed, so compositions can be keyed
 * by name ("scene-a") instead of by a magic number. Uses FNV-1a.
 */
export const hashSeed = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};
