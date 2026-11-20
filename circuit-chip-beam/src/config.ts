// All colours, counts and timings of the piece live here.
// (Look settings - exposure, light, fog, bloom, grain - live in look.ts.)

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
/** reference is 14.68 s -> round(14.68 * 30) = 440 frames (14.667 s) */
export const DURATION_FRAMES = 440;

export const SEED = 20241;

/** seconds */
export const TIMING = {
  traceWaveStart: 0.55, // light runs out along the traces
  traceWaveSpeed: 9.0, // world units / s
  flashPeak: 1.0, // the board flashes blue as the chip powers up
  dieRevealStart: 0.55, // pattern on the die lights up
  dieRiseStart: 1.0, // the die extrudes out of the board
  dieRiseEnd: 2.3,
  beamStart: 0.75, // first streaks leave the die
  beamSpread: 0.7, // streaks start over this many seconds
  beamRiseTime: 1.1, // seconds for one streak to reach full height
};

export const COUNTS = {
  chipTraceGroups: 28, // bundles of traces leaving the chip
  freeTraceBundles: 1100, // bundles of traces elsewhere on the board
  greebleAttempts: 52000, // dark relief blocks tried (overlaps are rejected)
  components: 900, // small lit parts
  barClusters: 420, // clusters of thin cyan bars
  partClusters: 150, // tight groups of small bright parts
  beamStreaks: 1600,
  beamBodyStreaks: 150,
  dust: 80,
};

export const SIZES = {
  boardHalf: 15, // board is 30 x 30 units, chip frame is 1.3 units
  grid: 0.05, // routing grid
  frameHalf: 0.66,
  frameWidth: 0.018,
  dieHalf: 0.5,
  dieHeightStart: 0.05,
  dieHeightEnd: 0.17,
  beamHeight: 11,
  beamHalf: 0.47,
};

export type Palette = {
  name: string;
  boardBase: string; // albedo of the board
  boardAmbient: string; // faint fill so the board never goes fully black
  keyLight: string; // light thrown by the glowing frame
  keyNeutral: [number, number, number]; // what that light is pulled towards where it lands on the board (linear RGB)
  beamLight: string; // light thrown by the beam
  frame: string; // neon frame around the chip
  traceDim: string;
  traceLit: string;
  pins: string;
  component: string; // white-ish lit parts
  bars: string; // cyan bar clusters
  accent: string; // rare contrasting parts
  dieGlow: string;
  beamCore: string; // streak colour near the base
  beamTop: string; // streak colour higher up
  beamHot: string; // brightest streaks
  dust: string;
  haze: string; // glow hanging in the air around the chip
  fog: string; // what the distance fades to
  /** final grade multipliers (shadows / highlights), 1 = neutral */
  gradeLift: [number, number, number];
  gradeGain: [number, number, number];
};

/** Version 1: the reference's deep navy + electric blue + teal beam. */
export const PALETTE_V1: Palette = {
  name: "electric-blue",
  boardBase: "#474b50",
  boardAmbient: "#3c4558",
  keyLight: "#2a8cff",
  keyNeutral: [0.22, 0.3, 0.42],
  beamLight: "#19c8d8",
  frame: "#3a8cff",
  traceDim: "#3a6088",
  traceLit: "#8fb8e8",
  pins: "#d7ecff",
  component: "#bfeaf5",
  bars: "#35d6e6",
  accent: "#2fe0c8",
  dieGlow: "#2aa5e8",
  beamCore: "#14b0d8",
  beamTop: "#06c4c8",
  beamHot: "#9ffcff",
  dust: "#3fe0e8",
  haze: "#1f6fc0",
  fog: "#04080e",
  gradeLift: [0.008, 0.011, 0.02],
  gradeGain: [1, 1, 1],
};

/** Version 2: the one change is the palette - ember orange + gold beam on a warm-black board. */
export const PALETTE_V2: Palette = {
  name: "ember-gold",
  boardBase: "#4b4744",
  boardAmbient: "#564036",
  keyLight: "#ff5a1f",
  keyNeutral: [0.42, 0.3, 0.22],
  beamLight: "#ffc21a",
  frame: "#ff6a2a",
  traceDim: "#886038",
  traceLit: "#e8c49c",
  pins: "#fff0d7",
  component: "#f5e2bf",
  bars: "#ffb035",
  accent: "#3cc8ff",
  dieGlow: "#f08a2a",
  beamCore: "#ff7a2f",
  beamTop: "#ffc612",
  beamHot: "#fff6a0",
  dust: "#ffd24a",
  haze: "#c0541f",
  fog: "#0e0804",
  gradeLift: [0.014, 0.009, 0.006],
  gradeGain: [1, 1, 1],
};

/**
 * Camera path. Each row: time (s), azimuth (deg, around the chip), elevation (deg),
 * distance, roll (deg), look-at target x / y / z.
 */
export const CAMERA_FOV = 34;
export const CAMERA_KEYS: {
  t: number; az: number; el: number; dist: number; roll: number; tx: number; ty: number; tz: number;
}[] = [
  { t: 0.0, az: -4, el: 26, dist: 12.6, roll: -3, tx: 0.1, ty: 0, tz: 0.3 },
  { t: 0.5, az: -4, el: 26, dist: 8.4, roll: -3, tx: 0.1, ty: 0, tz: 0.3 },
  { t: 1.0, az: -3, el: 27, dist: 4.4, roll: -2, tx: 0.05, ty: 0, tz: 0.3 },
  { t: 1.6, az: -2, el: 32, dist: 4.4, roll: -1, tx: 0.0, ty: 0, tz: 0.25 },
  { t: 2.5, az: -3, el: 37, dist: 4.6, roll: -1, tx: 0.0, ty: 0, tz: 0.2 },
  { t: 4.0, az: -10, el: 37, dist: 4.8, roll: -4, tx: -0.05, ty: 0, tz: 0.1 },
  { t: 7.0, az: -27, el: 31, dist: 5.0, roll: -12, tx: -0.2, ty: 0, tz: 0.1 },
  { t: 10.0, az: -34, el: 24, dist: 4.8, roll: -21, tx: -0.35, ty: 0, tz: 0.3 },
  { t: 12.0, az: -37, el: 21, dist: 4.6, roll: -26, tx: -0.45, ty: 0, tz: 0.4 },
  { t: 14.67, az: -39, el: 18, dist: 4.6, roll: -32, tx: -0.55, ty: 0, tz: 0.4 },
];
