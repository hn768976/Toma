// The "footage" being graded, and what the grade does to it.
//
// Nothing here draws anything. It produces the per-channel signal that
// the parade / waveform / vectorscope panels all read from, so every
// scope in a layout is showing the *same* shot, responding to the *same*
// control values. Scopes that disagree with each other are the fastest
// way to make a fake UI look fake.

import { clamp, fbm, hash, mix } from "./noise";
import type { P } from "./cursor";

export type Channel = "r" | "g" | "b";

export type Grade = {
  /** Per-channel shadow pedestal, roughly -0.2 .. 0.2. */
  lift: Record<Channel, number>;
  /** Per-channel midtone bend, roughly 0.7 .. 1.4. */
  gamma: Record<Channel, number>;
  /** Per-channel highlight multiplier, roughly 0.6 .. 1.5. */
  gain: Record<Channel, number>;
  /** Global exposure offset. */
  offset: number;
  /** Overall saturation multiplier, used by the vectorscope. */
  saturation: number;
};

export const NEUTRAL_GRADE: Grade = {
  lift: { r: 0, g: 0, b: 0 },
  gamma: { r: 1, g: 1, b: 1 },
  gain: { r: 1, g: 1, b: 1 },
  offset: 0,
  saturation: 1,
};

// A color wheel's puck sits in a -1..1 square. Pulling it toward a hue
// raises that channel and drops the opposing two, which is what a real
// lift/gamma/gain wheel does. Screen y grows downward, so the vertical
// term is negated.
const wheelToChannels = (
  puck: P,
  strength: number,
): Record<Channel, number> => {
  const x = clamp(puck.x, -1, 1);
  const y = -clamp(puck.y, -1, 1);
  // Red at upper-left, green at lower-left, blue at the right — matching
  // the hue ring the wheels are drawn with.
  const r = (-x * 0.5 + y * 0.866) * strength;
  const g = (-x * 0.5 - y * 0.866) * strength;
  const b = x * strength;
  return { r, g, b };
};

export const gradeFromControls = (controls: Record<string, P>): Grade => {
  const liftPuck = controls.lift ?? { x: 0, y: 0 };
  const gammaPuck = controls.gamma ?? { x: 0, y: 0 };
  const gainPuck = controls.gain ?? { x: 0, y: 0 };
  const offsetPuck = controls.offset ?? { x: 0, y: 0 };
  const exposure = controls.exposure ?? { x: 0, y: 0 };
  const sat = controls.saturation ?? { x: 0, y: 0 };

  const liftC = wheelToChannels(liftPuck, 0.16);
  const gammaC = wheelToChannels(gammaPuck, 0.3);
  const gainC = wheelToChannels(gainPuck, 0.42);
  const offsetC = wheelToChannels(offsetPuck, 0.1);

  return {
    lift: {
      r: liftC.r + offsetC.r,
      g: liftC.g + offsetC.g,
      b: liftC.b + offsetC.b,
    },
    gamma: {
      r: 1 + gammaC.r,
      g: 1 + gammaC.g,
      b: 1 + gammaC.b,
    },
    gain: { r: 1 + gainC.r, g: 1 + gainC.g, b: 1 + gainC.b },
    offset: exposure.y * -0.18,
    saturation: clamp(1 + sat.x * 0.9, 0, 2.2),
  };
};

/** Apply the grade to a single 0..1 sample of one channel. */
export const applyGrade = (grade: Grade, channel: Channel, v: number) => {
  const lifted = grade.lift[channel] + v * (1 - grade.lift[channel]);
  const gammaed = Math.pow(clamp(lifted, 0, 1), 1 / grade.gamma[channel]);
  return clamp(gammaed * grade.gain[channel] + grade.offset, 0, 1);
};

export type Column = { lo: number; hi: number; mid: number; density: number };

const CHANNEL_SEED: Record<Channel, number> = { r: 11, g: 47, b: 83 };

// One column of the parade, i.e. the distribution of one channel's values
// down a single column of the source image.
//
// The envelope moves slowly (the shot is drifting, not cutting) while the
// texture inside it churns fast — that split is what makes a waveform
// read as live video rather than an animated graph.
export const paradeColumn = (
  channel: Channel,
  u: number,
  frame: number,
  grade: Grade,
): Column => {
  const seed = CHANNEL_SEED[channel];
  const t = frame * 0.016;

  // Slow structural profile across the frame: sky bright at the top of
  // the range, a subject mass in the middle, shadow falloff at the sides.
  const structure =
    0.34 +
    0.3 * fbm(u * 3.1 + t * 0.5, seed, 3) +
    0.18 * Math.sin(u * 5.2 + t * 0.7 + seed);

  // Two highlight spikes that wander — practicals / specular hits.
  const spikeA = Math.exp(-Math.pow((u - (0.28 + 0.06 * Math.sin(t * 0.9))) / 0.045, 2));
  const spikeB = Math.exp(-Math.pow((u - (0.63 + 0.05 * Math.cos(t * 0.6))) / 0.035, 2));
  const spikes = spikeA * 0.42 + spikeB * 0.3;

  const rawMid = clamp(structure * 0.8 + spikes, 0.02, 1);
  // How wide the value distribution is in this column.
  const spread = 0.1 + 0.26 * fbm(u * 6.4 + t * 1.4, seed + 5, 2);

  const mid = applyGrade(grade, channel, rawMid);
  const hi = applyGrade(grade, channel, clamp(rawMid + spread, 0, 1));
  const lo = applyGrade(grade, channel, clamp(rawMid - spread * 0.75, 0, 1));

  return {
    lo,
    hi,
    mid,
    density: 0.45 + 0.55 * fbm(u * 9 + t * 2.2, seed + 9, 2),
  };
};

/**
 * A trace inside a column's envelope. `line` indexes the trace, and the
 * fast `frame` term is what makes the fill boil between frames.
 */
export const traceLevel = (
  col: Column,
  u: number,
  line: number,
  frame: number,
  seedBase: number,
) => {
  const jitter = fbm(u * 40 + frame * 0.9 + line * 13, seedBase + line * 31, 2);
  const band = (line + 0.5) / 6;
  return mix(col.lo, col.hi, clamp(band * 0.85 + (jitter - 0.5) * 0.5, 0, 1));
};

/** Deterministic speckle: bright single-pixel hits inside the waveform. */
export const speckle = (i: number, frame: number, seed: number) =>
  hash(i * 7919 + seed, frame);
