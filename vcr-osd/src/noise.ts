/**
 * Deterministic hashing. Every artifact in this piece is a pure function of the
 * frame number, so there is no Math.random() at render time and no state kept
 * between frames — frame N looks the same however many times it is rendered,
 * and frame `durationInFrames` is identical to frame 0.
 */

const mix = (x: number): number => {
  let h = x | 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
};

/** 32-bit hash of up to four integers. */
export const hashInt = (a: number, b = 0, c = 0, d = 0): number =>
  mix(
    Math.imul(a | 0, 0x27d4eb2f) ^
      Math.imul(b | 0, 0x165667b1) ^
      Math.imul(c | 0, 0x9e3779b1) ^
      Math.imul(d | 0, 0x85ebca6b),
  );

/** Hash mapped to [0, 1). */
export const hash01 = (a: number, b = 0, c = 0, d = 0): number =>
  hashInt(a, b, c, d) / 4294967296;

/** Hash mapped to [-1, 1). */
export const hashSigned = (a: number, b = 0, c = 0, d = 0): number =>
  hash01(a, b, c, d) * 2 - 1;

/**
 * Progress through an event that starts at `start` and lasts `duration`
 * frames, on a timeline that wraps at `period`. Returns a value in [0, 1) while
 * the event runs and -1 otherwise. Wrapping is what lets an event straddle the
 * loop point without breaking the seam.
 */
export const wrappedProgress = (
  frame: number,
  start: number,
  duration: number,
  period: number,
): number => {
  const since = ((frame - start) % period + period) % period;
  return since < duration ? since / duration : -1;
};
