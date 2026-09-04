/**
 * Deterministic helpers. Everything the animation does must be a pure
 * function of (row, frame mod durationInFrames) so the 600-frame loop
 * repeats exactly and frames can be rendered out of order on any thread.
 * No Math.random() is ever called at render time.
 */

/** Small, fast, fully deterministic PRNG (mulberry32). */
export const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Stateless hash of two integers -> [0, 1). */
export const hash2 = (a: number, b: number, salt = 0) => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

/** Stateless hash of one integer -> [0, 1). */
export const hash1 = (a: number, salt = 0) => hash2(a, 0x5bf03635, salt);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

/**
 * A sine that completes an integer number of cycles per loop, so it is
 * exactly periodic at the loop point. `cycles` must be an integer.
 */
export const loopSin = (cycles: number, phase: number, t: number) =>
  Math.sin(Math.PI * 2 * (cycles * t + phase));

/**
 * Shortest signed distance between two positions on a unit circle.
 * Used so glitch bursts and focus pulses wrap across the loop seam.
 */
export const cyclicDelta = (t: number, center: number) => {
  let d = t - center;
  d -= Math.round(d);
  return d;
};
