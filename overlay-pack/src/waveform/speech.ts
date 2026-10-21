import { createNoise3D, loopNoise } from "../lib/noise";

export const LOOP = 600;

const noise = createNoise3D(4131415843);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

// Wrapped loop time for frame f (any integer, negative included).
export const loopT = (f: number) => (((f % LOOP) + LOOP) % LOOP) / LOOP;

// Raw speech loudness 0..1 at loop time t: syllable bursts, gated into phrases
// with short pauses, riding a slow loudness drift. All noise is sampled on a
// circle in time, so t = 0 and t = 1 are the same point.
const rawEnvelope = (t: number) => {
  const syllable = clamp01(0.6 + 0.8 * loopNoise(noise, t, 72, 0.5));
  const phrase = smooth(-0.62, -0.32, loopNoise(noise, t, 11, 7.3));
  const loud = 0.72 + 0.28 * loopNoise(noise, t, 4, 13.1);
  return syllable * phrase * loud;
};

// Weights for the trailing average (sum to 1).
const SMOOTH = [0.26, 0.22, 0.18, 0.14, 0.11, 0.09];

// Lightly smoothed envelope: a short weighted average over the previous frames
// (still a pure function of the frame), so nothing jumps between frames.
export const speechEnvelope = (f: number) => {
  let s = 0;
  for (let i = 0; i < SMOOTH.length; i++) s += SMOOTH[i] * rawEnvelope(loopT(f - i));
  return s;
};

// Per-band variation for bar i at frame f, 0..1. Neighbouring bars differ, and
// each bar changes a little every frame.
export const bandLevel = (i: number, f: number) => {
  let s = 0;
  for (let k = 0; k < SMOOTH.length; k++) {
    const t = loopT(f - k);
    s += SMOOTH[k] * (0.5 + 0.5 * 1.25 * loopNoise(noise, t, 70, 40 + i * 0.42));
  }
  return clamp01(s);
};
