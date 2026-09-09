/**
 * Deterministic hashing.
 *
 * Every artifact in this project is a pure function of
 * `(elementId, frame mod durationInFrames)`. Nothing here reads `Math.random()`
 * and nothing keeps state between frames: Remotion renders frames out of order
 * across threads, so a stateful artifact list would flicker inconsistently, and
 * anything keyed on the raw frame number rather than `frame mod duration` would
 * break the loop.
 */

/** 32-bit integer hash of an arbitrary list of integers. */
export const hashInts = (...vals: number[]): number => {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < vals.length; i++) {
    let x = Math.imul(vals[i] | 0, 0x9e3779b1) >>> 0;
    x ^= x >>> 15;
    h = Math.imul(h ^ x, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
  }
  h ^= h >>> 16;
  return h >>> 0;
};

/** Hash to the half-open unit interval. */
export const rnd = (...vals: number[]): number => hashInts(...vals) / 4294967296;

/** Hash to `[min, max)`. */
export const rndRange = (min: number, max: number, ...vals: number[]): number =>
  min + rnd(...vals) * (max - min);

/** Hash to an integer in `[min, max]` inclusive. */
export const rndInt = (min: number, max: number, ...vals: number[]): number =>
  min + Math.floor(rnd(...vals) * (max - min + 1));

/** Positive modulo, so frame arithmetic can walk backwards over the loop seam. */
export const wrap = (value: number, period: number): number =>
  ((value % period) + period) % period;

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/**
 * Value noise over the frame axis that closes over the loop.
 *
 * `period` must be divisible by `step`, so the last control point interpolates
 * back into the first and frame `period` is identical to frame 0.
 */
export const loopNoise = (
  seed: number,
  frame: number,
  period: number,
  step: number,
): number => {
  const knots = Math.round(period / step);
  const pos = wrap(frame, period) / step;
  const i = Math.floor(pos);
  const t = smoothstep(pos - i);
  const a = rnd(seed, wrap(i, knots), 0x51ed);
  const b = rnd(seed, wrap(i + 1, knots), 0x51ed);
  return a + (b - a) * t;
};
