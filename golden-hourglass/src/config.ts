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
  sandEmpty: 13.75, // the upper bulb runs out of sand (keep in step with the last SAND_KEYS row)
  streamFallGravity: 55, // world units / s^2 - how fast the tail of the stream drops away
  streamThinStart: 12.9, // the stream narrows as the last sand goes
};

/** geometry, in world units (1 unit = distance from the neck to the top of the reference frame) */
export const SHAPE = {
  neckRadius: 0.1,
  neckHalfHeight: 0.07, // straight section of the neck above and below the middle
  upperSlope: 0.94, // radius gained per unit height, upper bulb
  lowerSlope: 0.72, // radius gained per unit depth, lower bulb
  lowerShoulder: 0.34, // extra bulge just under the neck
  lowerShoulderFall: 0.12,
  upperTop: 1.9,
  lowerBottom: -4.2,
  streamRadius: 0.07,
};

/**
 * Sand level in the upper bulb. Rows: time (s), height where the sand meets the glass, height of the
 * lowest point of the crater. The middle sinks first (funnel flow) while the sand against the glass
 * hangs on, then the rim collapses quickly near the end.
 */
export const SAND_KEYS: { t: number; rim: number; apex: number }[] = [
  { t: 0, rim: 0.93, apex: 0.66 },
  { t: 5, rim: 0.89, apex: 0.42 },
  { t: 9, rim: 0.82, apex: 0.22 },
  { t: 11.5, rim: 0.68, apex: 0.1 },
  { t: 13, rim: 0.42, apex: 0.0 },
  { t: 13.75, rim: 0.06, apex: -0.06 },
];

export const COUNTS = {
  upperSpecks: 900, // grains stuck to the inside of the upper bulb
  lowerSpecks: 260,
  latheSegments: 160,
  tinyGlints: 16, // small extra glints in a loose band left of the stream
};

/** star glints: where they sit (lower bulb unless `fixed`), angle around the axis (deg), size */
export const GLINTS: { y: number; phi: number; size: number; fixed?: [number, number, number]; seed: number }[] = [
  { y: -0.24, phi: 31, size: 1.0, seed: 0.11 },
  { y: -1.19, phi: 75, size: 0.85, seed: 0.37 },
  { y: 0.1, phi: 0, size: 0.62, fixed: [-0.24, 0.06, 0.12], seed: 0.53 },
  { y: -0.68, phi: -36, size: 0.3, seed: 0.71 },
  { y: -0.8, phi: -17, size: 0.2, seed: 0.23 },
  { y: -1.0, phi: -14, size: 0.24, seed: 0.89 },
  { y: -0.42, phi: -16, size: 0.17, seed: 0.42 },
  { y: -0.28, phi: -16, size: 0.14, seed: 0.64 },
  { y: -0.55, phi: 8, size: 0.12, seed: 0.05 },
  { y: -1.3, phi: 28, size: 0.15, seed: 0.95 },
  { y: -0.9, phi: 52, size: 0.13, seed: 0.31 },
  { y: -0.75, phi: -50, size: 0.1, seed: 0.18 },
  { y: -1.2, phi: -40, size: 0.11, seed: 0.58 },
  { y: -1.35, phi: -8, size: 0.1, seed: 0.83 },
  { y: -0.6, phi: -28, size: 0.09, seed: 0.47 },
  { y: 0.45, phi: 62, size: 0.18, seed: 0.77 },
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
  bgWarm: string; // faint warm wash low in the frame and around the glass
};

export const PALETTE: Palette = {
  name: "antique-gold",
  sandLight: "#d4b888",
  sandDark: "#2a180b",
  sparkle: "#ffe2a8",
  film: "#96652e",
  streak: "#ffd9a0",
  rimWarm: "#e0a55a",
  glintCore: "#fff4e0",
  glintRays: "#ff9a3c",
  hardware: "#0c0907",
  accent: "#c21f14",
  bgBase: "#242422",
  bgGlow: "#2f3233",
  bgWarm: "#2d2a28",
};

/**
 * Camera. Version 1 is locked off like the reference.
 * Version 2 changes only the camera movement: a slow push-in while arcing around the glass.
 * Rows: time (s), azimuth (deg), elevation (deg), distance, target x / y.
 */
export const CAMERA_FOV = 20;
export type CamKey = { t: number; az: number; el: number; dist: number; tx: number; ty: number };
export const CAMERA_V1: CamKey[] = [
  { t: 0, az: 0, el: 13, dist: 7.65, tx: -0.84, ty: -0.27 },
  { t: 17, az: 0, el: 13, dist: 7.45, tx: -1.03, ty: -0.36 }, // the reference drifts very slightly
];
export const CAMERA_V2: CamKey[] = [
  { t: 0, az: -30, el: 6, dist: 9.6, tx: -0.55, ty: -0.1 },
  { t: 6, az: -10, el: 12, dist: 8.0, tx: -0.6, ty: -0.2 },
  { t: 12, az: 12, el: 20, dist: 6.4, tx: -0.45, ty: -0.15 },
  { t: 17, az: 30, el: 28, dist: 5.2, tx: -0.3, ty: 0.0 },
];
