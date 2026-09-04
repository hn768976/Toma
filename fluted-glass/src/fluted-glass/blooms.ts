import { TAU } from "./constants";
import type { BloomTone } from "./palettes";
import { seededRandom } from "./random";

export type Bloom = {
  tone: BloomTone;
  /** Centre of the drift path, as a fraction of the frame. */
  cx: number;
  cy: number;
  /** Drift amplitude, as a fraction of the frame width/height. */
  ax: number;
  ay: number;
  /** Integer harmonic of the loop period on each axis - integers only, so
   *  the bloom is exactly back where it started at frame 360. */
  fy: number;
  /** Radius of the blob, as a fraction of the frame width. */
  radius: number;
  intensity: number;
  /** Depth of the intensity "breath", 0..1. */
  breath: number;
};

// Authored arrangement: one strong bloom crossing the upper left, another
// through the lower right, and only dim ones near the middle, so the centre
// of the frame stays the dark part of the composition.
const LAYOUT: Bloom[] = [
  { tone: "hot", cx: 0.22, cy: 0.28, ax: 0.11, ay: 0.075, fy: 1, radius: 0.27, intensity: 0.95, breath: 0.22 },
  { tone: "hot", cx: 0.78, cy: 0.74, ax: 0.095, ay: 0.07, fy: 2, radius: 0.24, intensity: 0.82, breath: 0.06 },
  { tone: "mid", cx: 0.86, cy: 0.18, ax: 0.075, ay: 0.055, fy: 1, radius: 0.21, intensity: 0.5, breath: 0.05 },
  { tone: "mid", cx: 0.14, cy: 0.82, ax: 0.085, ay: 0.05, fy: 2, radius: 0.22, intensity: 0.44, breath: 0.19 },
  { tone: "dim", cx: 0.42, cy: 0.58, ax: 0.06, ay: 0.045, fy: 1, radius: 0.19, intensity: 0.24, breath: 0.05 },
  { tone: "dim", cx: 0.64, cy: 0.38, ax: 0.07, ay: 0.04, fy: 2, radius: 0.26, intensity: 0.2, breath: 0.04 },
];

export type BloomPhases = {
  px: number;
  py: number;
  px2: number;
  py2: number;
  pb: number;
};

/** Phase offsets come from the seeded PRNG, never from Math.random(). */
export const bloomPhases = (index: number): BloomPhases => ({
  px: seededRandom(index, 11),
  py: seededRandom(index, 23),
  px2: seededRandom(index, 37),
  py2: seededRandom(index, 53),
  pb: seededRandom(index, 71),
});

export const BLOOMS = LAYOUT;
export const PHASES = LAYOUT.map((_, index) => bloomPhases(index));

export type BloomState = { x: number; y: number; radius: number; alpha: number };

/**
 * Position and intensity of a bloom at loop position `t` in [0, 1).
 * Every term is a sine of an integer multiple of t, so the whole state is
 * exactly periodic over the composition - the loop is seamless by
 * construction rather than by cross-fading.
 */
export const bloomStateAt = (
  bloom: Bloom,
  phases: BloomPhases,
  t: number,
): BloomState => {
  const x =
    bloom.cx +
    bloom.ax * Math.sin(TAU * (t + phases.px)) +
    bloom.ax * 0.28 * Math.sin(TAU * (2 * t + phases.px2));
  const y =
    bloom.cy +
    bloom.ay * Math.sin(TAU * (bloom.fy * t + phases.py)) +
    bloom.ay * 0.22 * Math.cos(TAU * (3 * t + phases.py2));

  const breath = Math.sin(TAU * (t + phases.pb));
  const alpha = bloom.intensity * (1 + bloom.breath * breath);
  const radius = bloom.radius * (1 + bloom.breath * 0.35 * breath);

  return { x, y, radius, alpha: Math.max(0, alpha) };
};
