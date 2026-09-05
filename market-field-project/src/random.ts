/**
 * Deterministic, stateless randomness.
 *
 * Remotion renders frames out of order and across threads, so nothing here
 * may accumulate: every value must be recoverable from its inputs alone.
 */

/** mulberry32 — used where a *sequence* is wanted (bar placement, setup). */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Hash a single integer to [0, 1) — used per data point, per frame. */
export const hash1 = (i: number, seed: number) => {
  let t = (Math.imul(i, 0x27d4eb2d) ^ seed) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Signed variant in [-1, 1). */
export const hash1s = (i: number, seed: number) => hash1(i, seed) * 2 - 1;

export const smoothstep = (t: number) => t * t * (3 - 2 * t);

export const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

export const mod = (a: number, n: number) => ((a % n) + n) % n;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
