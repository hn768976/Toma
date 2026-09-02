import { wrap } from "./random";

/**
 * Helpers for motion that closes EXACTLY at the end of a looping composition.
 *
 * The trap these exist to avoid: sin(phase + 2*PI*cycles) is algebraically
 * equal to sin(phase) but not bit-identical to it in floating point, and that
 * difference is enough to change the odd pixel between the first and last
 * frame of a loop. Reducing the argument with a wrap BEFORE the trig call
 * makes the two identical, so a loop check comes back at zero differing
 * pixels rather than "close enough".
 *
 * Pass `t` as frame / durationInFrames, and `cycles` as a whole number.
 */

export const loopT = (frame: number, durationInFrames: number) =>
  frame / durationInFrames;

export const loopSin = (t: number, cycles: number, phase = 0) =>
  Math.sin(2 * Math.PI * wrap(cycles * t, 1) + phase);

export const loopCos = (t: number, cycles: number, phase = 0) =>
  Math.cos(2 * Math.PI * wrap(cycles * t, 1) + phase);

/** An angle advancing `cycles` whole turns per loop, wrapped to [0, 2*PI). */
export const loopAngle = (t: number, cycles: number, phase = 0) =>
  2 * Math.PI * wrap(cycles * t, 1) + phase;

/**
 * A small closed figure-of-eight, for a drifting camera. `amount` is the
 * horizontal amplitude in pixels; the vertical swing is `verticalRatio` of it
 * at double the frequency, so the path returns exactly to its start.
 *
 * Give each depth layer a different `amount` and the difference between them
 * is the parallax.
 */
export const cameraDrift = (t: number, amount: number, verticalRatio = 0.25) => ({
  x: amount * loopSin(t, 1),
  y: amount * verticalRatio * loopSin(t, 2),
});
