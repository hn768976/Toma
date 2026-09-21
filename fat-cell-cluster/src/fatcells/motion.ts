/**
 * Motion, all of it a pure function of the frame.
 *
 * Looks 1, 2 and 4 are seamless 300-frame loops, which constrains every moving
 * value to close exactly at t = 1: rotations are whole turns about a fixed
 * axis and drifts are closed Lissajous figures with integer frequencies. A
 * fractional turn or a non-integer frequency anywhere shows up as a jump at
 * the loop point, so those counts are drawn as integers at build time and
 * never scaled afterwards.
 *
 * Look 3 does not loop. Its deflation runs once, start to finish.
 */

import { Rng, rangeInt, range, onSphere } from "./random";

export type DriftSpec = {
  amplitude: [number, number, number];
  frequency: [number, number, number];
  phase: [number, number, number];
};

export type SpinSpec = {
  axis: [number, number, number];
  /** Whole turns over the composition. Never fractional. */
  turns: number;
  /** Starting angle, in radians. */
  phase: number;
};

export const makeDrift = (
  rng: Rng,
  amplitude: number,
  maxFrequency = 2,
): DriftSpec => ({
  amplitude: [
    amplitude * range(rng, 0.7, 1.3),
    amplitude * range(rng, 0.7, 1.3),
    amplitude * range(rng, 0.5, 1.0),
  ],
  frequency: [
    rangeInt(rng, 1, maxFrequency),
    rangeInt(rng, 1, maxFrequency),
    rangeInt(rng, 1, maxFrequency),
  ],
  phase: [
    range(rng, 0, Math.PI * 2),
    range(rng, 0, Math.PI * 2),
    range(rng, 0, Math.PI * 2),
  ],
});

export const makeSpin = (rng: Rng, turns: number): SpinSpec => {
  const axis = onSphere(rng);
  // A cluster that does not turn keeps the orientation it was built in. The
  // tissue slabs depend on that: a random standing rotation would tilt a slab
  // that was sized to cover the frame and let the background show at a corner.
  const phase = turns === 0 ? 0 : range(rng, 0, Math.PI * 2);
  return { axis, turns, phase };
};

/** Position offset at normalised time t in [0, 1); closed by construction. */
export const driftAt = (
  spec: DriftSpec,
  t: number,
): [number, number, number] => {
  const T = Math.PI * 2 * t;
  return [
    spec.amplitude[0] * Math.sin(T * spec.frequency[0] + spec.phase[0]),
    spec.amplitude[1] * Math.sin(T * spec.frequency[1] + spec.phase[1]),
    spec.amplitude[2] * Math.sin(T * spec.frequency[2] + spec.phase[2]),
  ];
};

export const spinAt = (spec: SpinSpec, t: number): number =>
  spec.phase + Math.PI * 2 * spec.turns * t;

/**
 * Deflation progress for one cell.
 *
 * Offsets are spread over roughly the first 60% of the clip and spans run
 * 0.3-0.4, so the cluster comes apart over the whole composition instead of
 * collapsing at once.
 */
export type DeflationSpec = { offset: number; span: number };

export const makeDeflation = (rng: Rng, count: number): DeflationSpec[] =>
  Array.from({ length: count }, () => ({
    offset: range(rng, 0, 0.6),
    span: range(rng, 0.3, 0.4),
  }));

export const deflationAt = (spec: DeflationSpec, t: number): number =>
  Math.max(0, Math.min(1, (t - spec.offset) / spec.span));
