import { cosc, osc } from "./loop";

/**
 * Camera framing. Half-height of the z=0 plane is `distance * tan(fov/2)`,
 * which with these values is ~1.607 world units, so the 16:9 frame spans
 * roughly x in [-2.86, 2.86] and y in [-1.61, 1.61].
 */
export const CAMERA = { fov: 30, distance: 6 } as const;

/** Constant sheet thickness -- every disc is cut from the same glass. */
export const GLASS_HALF_THICKNESS = 0.032;

export type DiscSpec = {
  name: string;
  radius: number;
  center: [number, number, number];
  /** Drift amplitudes and whole-cycle frequencies, per axis. */
  drift: {
    amplitude: [number, number, number];
    frequency: [number, number, number];
    phase: [number, number, number];
  };
  /** Slow tilt away from camera-facing, in radians. */
  tilt: { amplitude: [number, number]; frequency: [number, number]; phase: [number, number] };
  /** Rotation about the disc's own axis, in radians. */
  spin: { amplitude: number; frequency: number; phase: number };
};

/**
 * Three overlapping discs, matching the structure both references settle into:
 * one hero circle filling most of the frame, a small one clipped by the top-left
 * corner, and a large one entering from the right edge.
 */
export const DISCS: DiscSpec[] = [
  {
    name: "hero",
    radius: 1.95,
    center: [0.25, -0.12, 0],
    drift: {
      amplitude: [0.2, 0.14, 0.1],
      frequency: [1, 1, 2],
      phase: [0.0, 0.25, 0.12],
    },
    tilt: {
      amplitude: [0.055, 0.07],
      frequency: [1, 1],
      phase: [0.1, 0.62],
    },
    spin: { amplitude: 0.22, frequency: 1, phase: 0.3 },
  },
  {
    name: "small",
    radius: 0.56,
    center: [-2.05, 1.18, 0.62],
    drift: {
      amplitude: [0.16, 0.12, 0.08],
      frequency: [1, 2, 1],
      phase: [0.45, 0.1, 0.7],
    },
    tilt: {
      amplitude: [0.12, 0.1],
      frequency: [1, 1],
      phase: [0.55, 0.2],
    },
    spin: { amplitude: 0.5, frequency: 1, phase: 0.8 },
  },
  {
    name: "edge",
    radius: 1.55,
    center: [2.95, -0.75, -0.55],
    drift: {
      amplitude: [0.22, 0.18, 0.12],
      frequency: [1, 1, 1],
      phase: [0.7, 0.85, 0.4],
    },
    tilt: {
      amplitude: [0.07, 0.085],
      frequency: [1, 1],
      phase: [0.35, 0.9],
    },
    spin: { amplitude: 0.3, frequency: 1, phase: 0.15 },
  },
];

export type DiscTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
};

/** Pure frame -> transform. `cycle` runs 0..1 across the clip. */
export const discTransform = (spec: DiscSpec, cycle: number): DiscTransform => {
  const { center, drift, tilt, spin } = spec;
  return {
    position: [
      center[0] + drift.amplitude[0] * osc(cycle, drift.frequency[0], drift.phase[0]),
      center[1] + drift.amplitude[1] * cosc(cycle, drift.frequency[1], drift.phase[1]),
      center[2] + drift.amplitude[2] * osc(cycle, drift.frequency[2], drift.phase[2]),
    ],
    rotation: [
      tilt.amplitude[0] * osc(cycle, tilt.frequency[0], tilt.phase[0]),
      tilt.amplitude[1] * cosc(cycle, tilt.frequency[1], tilt.phase[1]),
      spin.amplitude * osc(cycle, spin.frequency, spin.phase),
    ],
  };
};

/** Gentle parallax so the composition breathes without the framing drifting. */
export const cameraOffset = (cycle: number): [number, number] => [
  0.085 * osc(cycle, 1, 0.18),
  0.055 * cosc(cycle, 1, 0.55),
];

/** Slow swing of the lighting environment: the "light motion" in both briefs. */
export const environmentRotation = (cycle: number): [number, number, number] => [
  0.1 * osc(cycle, 1, 0.3),
  0.34 * osc(cycle, 1, 0.0),
  0.05 * cosc(cycle, 1, 0.7),
];

/** Path of the soft light pool drifting across the backdrop. */
export const backdropGlow = (cycle: number): [number, number] => [
  1.1 + 1.5 * osc(cycle, 1, 0.12),
  -0.6 + 0.9 * cosc(cycle, 1, 0.12),
];
