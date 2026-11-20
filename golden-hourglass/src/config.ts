// All colours, counts and timings of the piece live here.
// (Look settings - exposure, light, haze, bloom, grain - live in look.ts.)

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
/** reference is 16.950 s (29.97 fps, 508 frames) -> round(16.950 * 30) = 509 frames (16.967 s) */
export const DURATION_FRAMES = 509;

export const SEED = 7741;

/** seconds */
export const TIMING = {
  sandEmpty: 13.75, // the upper bulb runs out of sand
  streamFallGravity: 55, // world units / s^2 - how fast the tail of the stream drops away
  streamThinStart: 12.9, // the stream narrows as the last sand goes
};

/** geometry, in world units (1 unit = distance from the neck to the top of the reference frame) */
export const SHAPE = {
  neckRadius: 0.1,
  upperSlope: 0.94, // radius gained per unit height, upper bulb
  lowerSlope: 0.75, // radius gained per unit depth, lower bulb
  lowerShoulder: 0.22, // extra bulge just under the neck
  lowerShoulderFall: 0.15,
  upperTop: 1.9,
  lowerBottom: -4.2,
  sandStartApex: 0.45, // height of the crater's lowest point at t = 0
  sandSlope: 0.6, // slope of the sand surface towards the middle
  streamRadius: 0.07,
};

export const COUNTS = {
  upperSpecks: 1500, // grains stuck to the inside of the upper bulb
  lowerSpecks: 2600,
  latheSegments: 160,
};

/** star glints: where they sit (lower bulb unless `fixed`), angle around the axis (deg), size */
export const GLINTS: { y: number; phi: number; size: number; fixed?: [number, number, number]; seed: number }[] = [
  { y: -0.24, phi: 31, size: 1.0, seed: 0.11 },
  { y: -1.19, phi: 75, size: 0.9, seed: 0.37 },
  { y: 0.1, phi: 0, size: 0.8, fixed: [-0.27, 0.1, 0.12], seed: 0.53 },
  { y: -0.68, phi: -36, size: 0.4, seed: 0.71 },
  { y: -0.8, phi: -17, size: 0.33, seed: 0.23 },
  { y: -1.0, phi: -14, size: 0.36, seed: 0.89 },
  { y: -0.42, phi: -16, size: 0.3, seed: 0.42 },
  { y: -0.28, phi: -16, size: 0.26, seed: 0.64 },
  { y: -0.52, phi: 12, size: 0.2, seed: 0.05 },
  { y: -1.3, phi: 30, size: 0.2, seed: 0.95 },
];

export type Palette = {
  name: string;
  sandLight: string; // lit sand
  sandDark: string; // sand in shade
  sparkle: string; // glitter grains
  film: string; // fine dust coating the glass
  streak: string; // main highlight running down the lower bulb
  rimWarm: string; // warm edge highlights
  glintCore: string;
  glintRays: string;
  hardware: string; // the dark collar at the neck
  accent: string; // small coloured reflection at the neck
  bgBase: string; // darkest background (also the matte black level)
  bgGlow: string; // soft lighter area on the left
};

export const PALETTE: Palette = {
  name: "antique-gold",
  sandLight: "#c2924f",
  sandDark: "#3a2616",
  sparkle: "#fff1cf",
  film: "#8a6642",
  streak: "#fff3df",
  rimWarm: "#e0a55a",
  glintCore: "#fff6e6",
  glintRays: "#ffb45e",
  hardware: "#0c0907",
  accent: "#c21f14",
  bgBase: "#242422",
  bgGlow: "#313230",
};

/**
 * Camera. Version 1 is locked off like the reference.
 * Version 2 changes only the camera movement: a slow push-in while arcing around the glass.
 * Rows: time (s), azimuth (deg), elevation (deg), distance, target x / y.
 */
export const CAMERA_FOV = 20;
export type CamKey = { t: number; az: number; el: number; dist: number; tx: number; ty: number };
export const CAMERA_V1: CamKey[] = [
  { t: 0, az: 0, el: 20, dist: 7.65, tx: -0.84, ty: -0.27 },
  { t: 17, az: 0, el: 20, dist: 7.65, tx: -0.84, ty: -0.27 },
];
export const CAMERA_V2: CamKey[] = [
  { t: 0, az: -16, el: 14, dist: 8.3, tx: -0.84, ty: -0.2 },
  { t: 6, az: -5, el: 18, dist: 7.4, tx: -0.72, ty: -0.24 },
  { t: 12, az: 7, el: 22, dist: 6.5, tx: -0.55, ty: -0.2 },
  { t: 17, az: 16, el: 25, dist: 5.9, tx: -0.42, ty: -0.1 },
];
