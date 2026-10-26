import { Easing, interpolate } from "remotion";

// The sky is infinitely far away, so only the camera's orientation matters.
export type CameraPose = {
  yaw: number; // radians, positive turns right
  pitch: number; // radians, positive looks up
  roll: number; // radians, positive banks right
};

export type SkyShot = {
  name: string;
  fovY: number; // degrees
  moonAzimuth: number; // degrees, positive = right of -z
  moonElevation: number; // degrees
  pose: (t: number, duration: number) => CameraPose;
};

const deg = Math.PI / 180;

// Version 1: the reference framing. A near-locked view with the moon low on
// the right of frame and only a faint hand-held drift.
export const LOCKED_SHOT: SkyShot = {
  name: "locked",
  fovY: 40,
  moonAzimuth: 15.5,
  moonElevation: 3.7,
  pose: (t) => ({
    yaw: 0.004 * Math.sin(t * 0.4),
    pitch: 1.6 * deg + 0.002 * Math.sin(t * 0.55),
    roll: 0.003 * Math.sin(t * 0.7),
  }),
};

// Version 2: alternative camera move. The camera tilts down and banks into a
// turn to the right, so the moon swings from the right edge towards centre and
// the horizon rolls through frame.
export const BANKING_TURN_SHOT: SkyShot = {
  name: "banking-turn",
  fovY: 40,
  moonAzimuth: 24,
  moonElevation: 6.5,
  pose: (t, duration) => {
    const p = interpolate(t, [0, duration], [0, 1], {
      easing: Easing.inOut(Easing.sin),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return {
      yaw: interpolate(p, [0, 1], [-6 * deg, 17 * deg]),
      pitch: interpolate(p, [0, 1], [3.5 * deg, -3.5 * deg]),
      roll: interpolate(p, [0, 0.45, 1], [3 * deg, -8 * deg, -3 * deg]),
    };
  },
};

export const SKY_SHOTS = {
  locked: LOCKED_SHOT,
  "banking-turn": BANKING_TURN_SHOT,
} as const;

export type SkyShotId = keyof typeof SKY_SHOTS;
