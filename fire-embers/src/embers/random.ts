/**
 * Deterministic randomness.
 *
 * Everything in this project must be a pure function of the frame number:
 * Remotion renders frames out of order across worker threads, so any
 * `Math.random()` at render time — or any mutable field carried between
 * frames — would flicker and break the loop. All randomness is drawn once,
 * at module scope, from a seeded generator.
 */

/** mulberry32 — small, fast, well-distributed 32-bit PRNG. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Uniform float in [min, max). */
export const range = (rnd: () => number, min: number, max: number): number =>
  min + rnd() * (max - min);

/** Integer in [min, max]. */
export const rangeInt = (rnd: () => number, min: number, max: number): number =>
  Math.floor(min + rnd() * (max - min + 1));

/**
 * Biased toward `min` when `power > 1`, toward `max` when `power < 1`.
 * Used to skew depth distributions inside a particle class.
 */
export const rangeBiased = (
  rnd: () => number,
  min: number,
  max: number,
  power: number,
): number => min + Math.pow(rnd(), power) * (max - min);

/** Integer hash → [0, 1). Used by the noise field, which takes no PRNG state. */
export const hash1 = (x: number): number => {
  let h = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
