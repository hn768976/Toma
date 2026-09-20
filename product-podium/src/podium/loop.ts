/**
 * Loop-safe time.
 *
 * Every animated quantity in the project is a function of `t = frame /
 * durationInFrames`, and every one of them completes a whole number of cycles
 * over that range, so frame `durationInFrames` is identical to frame 0.
 * That is what makes the clip seamless when a buyer loops it under a product
 * shot for a minute at a time.
 */
import { fbm3 } from "./random";

/** Normalised loop position in [0, 1). */
export const loopT = (frame: number, durationInFrames: number) =>
  (frame / durationInFrames) % 1;

/** Sine that completes `cycles` whole cycles over the clip. Range [-1, 1]. */
export const loopSin = (
  frame: number,
  durationInFrames: number,
  cycles: number,
  phase = 0,
) => Math.sin(2 * Math.PI * (cycles * loopT(frame, durationInFrames) + phase));

/** `loopSin` remapped to [lo, hi]. */
export const loopRange = (
  frame: number,
  durationInFrames: number,
  cycles: number,
  lo: number,
  hi: number,
  phase = 0,
) => lo + ((loopSin(frame, durationInFrames, cycles, phase) + 1) / 2) * (hi - lo);

/** Position in [0, 1) that advances `cycles` times round the clip — a travelling segment. */
export const loopPhase = (
  frame: number,
  durationInFrames: number,
  cycles: number,
  offset = 0,
) => (cycles * loopT(frame, durationInFrames) + offset) % 1;

/**
 * Noise sampled on a circle in time: `noise(x, cos 2πt, sin 2πt)`.
 * Because the sample point returns to where it started, the value is exactly
 * periodic over the clip while still looking like noise rather than a sine.
 */
export const loopNoise = (
  frame: number,
  durationInFrames: number,
  x: number,
  radius = 1,
  seed = 1,
  octaves = 3,
) => {
  const a = 2 * Math.PI * loopT(frame, durationInFrames);
  return fbm3(x, radius * Math.cos(a), radius * Math.sin(a), octaves, seed);
};

/** `loopNoise` remapped to [lo, hi]. */
export const loopNoiseRange = (
  frame: number,
  durationInFrames: number,
  x: number,
  lo: number,
  hi: number,
  radius = 1,
  seed = 1,
) => {
  const n = loopNoise(frame, durationInFrames, x, radius, seed);
  return lo + ((Math.max(-1, Math.min(1, n)) + 1) / 2) * (hi - lo);
};
