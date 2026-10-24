import { Easing, interpolate } from "remotion";
import { HeroCloud } from "./field";

export type CameraPose = {
  x: number;
  y: number;
  z: number;
  yaw: number; // radians, positive turns right
  pitch: number; // radians, positive looks up
  roll: number; // radians, positive banks right
};

export type CloudShot = {
  name: string;
  fovY: number; // degrees
  // fade puffs out before the camera flies through them (hides billboard cuts)
  lensFade?: boolean;
  speed: number; // world units per second along -z
  moonAzimuth: number; // degrees, positive = right of -z
  moonElevation: number; // degrees
  heroes: HeroCloud[];
  pose: (t: number, duration: number) => CameraPose;
};

const deg = Math.PI / 180;

// Version 1: the reference shot. Steady forward glide just above the cloud
// tops with the moon low on the right; a large cloud sweeps past early on.
export const GLIDE_SHOT: CloudShot = {
  name: "glide",
  fovY: 40,
  speed: 12,
  moonAzimuth: 15.5,
  moonElevation: 3.7,
  heroes: [
    // dark mass under the moon at the start
    { x: 2.6, z: -12 * 0.85, radius: 5.0, height: 4.5, baseY: 3.4, brightness: 0.6 },
    // big moonlit cloud that sweeps across the moon and off to the right
    { x: 6.2, z: -12 * 1.95, radius: 7.0, height: 6.0, baseY: 4.0, brightness: 1.2 },
    // near cloud passing on the left
    { x: -9.5, z: -12 * 2.7, radius: 5.5, height: 4.2, baseY: 2.4 },
  ],
  pose: (t) => ({
    x: 0,
    y: 8.4 + 0.4 * Math.sin(t * 0.55),
    z: -12 * t,
    yaw: 0.004 * Math.sin(t * 0.4),
    pitch: 1.6 * deg,
    roll: 0.003 * Math.sin(t * 0.7),
  }),
};

// Version 2: alternative camera move. The camera starts skimming through the
// cloud tops, then cranes up into a banking turn to the right so the moon
// swings from the right of frame towards centre over a wide cloud sea.
export const BANKING_RISE_SHOT: CloudShot = {
  name: "banking-rise",
  fovY: 40,
  lensFade: true,
  speed: 8,
  moonAzimuth: 24,
  moonElevation: 6.5,
  heroes: [{ x: 4.5, z: -8 * 1.6, radius: 5.0, height: 5.0, baseY: 4.0, brightness: 1.3 }],
  pose: (t, duration) => {
    const p = interpolate(t, [0, duration], [0, 1], {
      easing: Easing.inOut(Easing.sin),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return {
      x: interpolate(p, [0, 1], [0, 12]),
      y: interpolate(p, [0, 1], [6.5, 13.5]),
      z: -8 * t,
      yaw: interpolate(p, [0, 1], [-6 * deg, 17 * deg]),
      pitch: interpolate(p, [0, 1], [3.5 * deg, -3.5 * deg]),
      roll: interpolate(p, [0, 0.45, 1], [3 * deg, -8 * deg, -3 * deg]),
    };
  },
};

export const CLOUD_SHOTS = {
  glide: GLIDE_SHOT,
  "banking-rise": BANKING_RISE_SHOT,
} as const;

export type CloudShotId = keyof typeof CLOUD_SHOTS;
