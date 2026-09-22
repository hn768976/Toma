import { DURATION_IN_FRAMES } from "./constants";

// ---------------------------------------------------------------------------
// Loop helpers.
//
// Frame 600 must be pixel-identical to frame 0. Every helper here takes a
// `cycles` argument that MUST be an integer.
//
// Each helper also WRAPS its argument into a single period before using it.
// That is not cosmetic: `rotate(720deg)` and `rotate(0deg)` do not produce a
// bit-identical matrix (cos(4*PI) is 0.9999999999999999, not 1), and a
// stroke-dashoffset of -18000 does not land on exactly the same dash phase as
// 0. Both leave a scatter of one-off pixels at the wrap point. Reducing to
// the principal value first removes that class of error entirely.
// ---------------------------------------------------------------------------

/** Fractional part, always in [0, 1). */
export const frac = (x: number) => x - Math.floor(x);

/** Normalised loop position, 0 at frame 0 and 1 at frame DURATION_IN_FRAMES. */
export const loopT = (frame: number) => frame / DURATION_IN_FRAMES;

/** Phase in [0, 1) after `cycles` integer repetitions over the loop. */
export const phase = (frame: number, cycles: number, shift = 0) =>
  frac(loopT(frame) * cycles + shift);

/** sin() over `cycles` integer repetitions, offset by `shift` turns. */
export const wave = (frame: number, cycles: number, shift = 0) =>
  Math.sin(2 * Math.PI * phase(frame, cycles, shift));

/** cos() over `cycles` integer repetitions, offset by `shift` turns. */
export const cwave = (frame: number, cycles: number, shift = 0) =>
  Math.cos(2 * Math.PI * phase(frame, cycles, shift));

/**
 * Degrees of rotation after `revs` integer revolutions, reduced to [0, 360).
 * Negative `revs` reverses the direction.
 */
export const spin = (frame: number, revs: number, shift = 0) =>
  phase(frame, revs, shift) * 360;

/**
 * A smooth 0..1..0 pulse that peaks once per cycle. Continuous at the wrap
 * point, so a highlight driven by this is never caught mid-jump.
 * `width` is the fraction of the cycle the pulse occupies.
 */
export const pulse = (frame: number, cycles: number, shift: number, width: number) => {
  const p = frac(phase(frame, cycles) - shift);
  if (p > width) return 0;
  return 0.5 - 0.5 * Math.cos((p / width) * 2 * Math.PI);
};

/** Blend between `min` and `max` on a sine of integer period. */
export const osc = (
  frame: number,
  cycles: number,
  shift: number,
  min: number,
  max: number,
) => min + (max - min) * (0.5 + 0.5 * wave(frame, cycles, shift));

/**
 * Stroke-dash phase for a pulse travelling a run of `length` units,
 * `cycles` times over the loop. Wrapped into one pattern period.
 */
export const dashPhase = (frame: number, length: number, cycles: number, shift: number) =>
  -frac(loopT(frame) * cycles + shift) * length;
