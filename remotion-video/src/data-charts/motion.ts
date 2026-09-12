import { Easing, interpolate } from "remotion";
import { mulberry32 } from "../particle-ring/random";

// 0 -> 1 ease-out progress starting at `start` and lasting `duration`
// frames. Clamped on both ends so it is safe to call for any frame.
export const buildIn = (frame: number, start: number, duration: number) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

// Overshooting ease for "growing" marks (bars, arcs).
export const buildInBack = (frame: number, start: number, duration: number) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.4)),
  });

// Deterministic list of `count` pseudo-random values in [0, 1) for a seed.
// Never Math.random(): Remotion renders frames out of order across workers,
// so anything not a pure function of (seed, frame) would flicker.
export const seededSeries = (seed: number, count: number) => {
  const rand = mulberry32(seed * 7919 + 17);
  return Array.from({ length: count }, () => rand());
};

// Smooth 1D value noise in [0, 1): interpolates between seeded lattice
// values so it can be sampled continuously by frame for organic drift.
export const smoothNoise = (seed: number, x: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const a = mulberry32(seed * 104729 + i * 31 + 7)();
  const b = mulberry32(seed * 104729 + (i + 1) * 31 + 7)();
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
