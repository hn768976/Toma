import { Vec3 } from "./math";

export type EarthPalette = {
  space: Vec3; // background top
  spaceLow: Vec3; // background near the horizon
  oceanNight: Vec3;
  landNight: Vec3;
  oceanDay: Vec3;
  landDay: Vec3;
  city: Vec3;
  rimCool: Vec3; // atmosphere rim away from the sun
  rimWarm: Vec3; // atmosphere rim close to the sun
  sunCore: Vec3;
  sunGlow: Vec3;
  streak: Vec3;
  netCool: Vec3;
  netWarm: Vec3;
  star: Vec3;
  hud: string; // CSS colour for the countdown
  hudGlow: string;
};

/** Version 1 – matches the reference: navy night side, golden sunrise. */
export const SUNRISE_PALETTE: EarthPalette = {
  space: [0.0, 0.0, 0.004],
  spaceLow: [0.012, 0.02, 0.045],
  oceanNight: [0.003, 0.008, 0.024],
  landNight: [0.018, 0.03, 0.058],
  oceanDay: [0.1, 0.16, 0.24],
  landDay: [0.62, 0.48, 0.3],
  city: [1.0, 0.72, 0.38],
  rimCool: [0.25, 0.45, 0.95],
  rimWarm: [1.0, 0.33, 0.07],
  sunCore: [1.0, 0.93, 0.78],
  sunGlow: [1.0, 0.48, 0.14],
  streak: [1.0, 0.5, 0.18],
  netCool: [0.62, 0.76, 1.0],
  netWarm: [1.0, 0.78, 0.48],
  star: [0.75, 0.82, 1.0],
  hud: "rgba(236, 238, 255, 0.97)",
  hudGlow: "rgba(150, 175, 255, 0.55)",
};

/**
 * Version 2 – alternative colour palette: an "aurora dawn" grade with an
 * emerald/teal network and atmosphere and a magenta-violet sunrise.
 */
export const AURORA_PALETTE: EarthPalette = {
  space: [0.004, 0.0, 0.01],
  spaceLow: [0.01, 0.03, 0.04],
  oceanNight: [0.002, 0.011, 0.017],
  landNight: [0.011, 0.035, 0.04],
  oceanDay: [0.08, 0.12, 0.2],
  landDay: [0.45, 0.32, 0.55],
  city: [0.45, 1.0, 0.86],
  rimCool: [0.08, 0.66, 0.52],
  rimWarm: [0.95, 0.25, 0.8],
  sunCore: [1.0, 0.88, 1.0],
  sunGlow: [0.85, 0.3, 1.0],
  streak: [0.7, 0.4, 1.0],
  netCool: [0.4, 1.0, 0.82],
  netWarm: [1.0, 0.62, 0.95],
  star: [0.75, 1.0, 0.95],
  hud: "rgba(225, 255, 246, 0.97)",
  hudGlow: "rgba(90, 255, 205, 0.5)",
};
