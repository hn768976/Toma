import { Easing, interpolate } from "remotion";

// The sky is infinitely far away, so only the camera's orientation matters.
export type CameraPose = {
  yaw: number; // radians, positive turns right
  pitch: number; // radians, positive looks up
  roll: number; // radians, positive banks right
  fovY: number; // degrees; narrowing it pushes in, widening it pulls out
};

export type SkyShot = {
  name: string;
  moonAzimuth: number; // degrees, positive = right of -z
  moonElevation: number; // degrees
  pose: (t: number, duration: number) => CameraPose;
};

const deg = Math.PI / 180;

// Version 1: the reference framing (moon low on the right) with a slow push
// in towards the moon and a faint hand-held drift.
export const PUSH_IN_SHOT: SkyShot = {
  name: "push-in",
  moonAzimuth: 15.5,
  moonElevation: 3.7,
  pose: (t, duration) => {
    const p = interpolate(t, [0, duration], [0, 1], {
      easing: Easing.inOut(Easing.sin),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return {
      // turn slightly towards the moon while closing in so it stays framed
      yaw: interpolate(p, [0, 1], [0, 4 * deg]) + 0.004 * Math.sin(t * 0.4),
      pitch: interpolate(p, [0, 1], [1.6 * deg, 2.4 * deg]) + 0.002 * Math.sin(t * 0.55),
      roll: 0.003 * Math.sin(t * 0.7),
      fovY: interpolate(p, [0, 1], [40, 30]),
    };
  },
};

// Version 2: alternative camera move. The camera pulls out slowly while it
// tilts down and banks into a turn to the right, so the moon swings from the
// right edge towards centre and the horizon rolls through frame.
export const PULL_OUT_SHOT: SkyShot = {
  name: "pull-out",
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
      fovY: interpolate(p, [0, 1], [32, 46]),
    };
  },
};

export const SKY_SHOTS = {
  "push-in": PUSH_IN_SHOT,
  "pull-out": PULL_OUT_SHOT,
} as const;

export type SkyShotId = keyof typeof SKY_SHOTS;
