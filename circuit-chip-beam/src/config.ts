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
  beamStart: 1.0, // first streaks leave the die
  beamSpread: 0.9, // streaks start over this many seconds
  beamRiseTime: 1.1, // seconds for one streak to reach full height
};

export const COUNTS = {
  chipTraceGroups: 44, // bundles of traces leaving the chip
  freeTraceBundles: 1100, // bundles of traces elsewhere on the board
  greebleAttempts: 52000, // dark relief blocks tried (overlaps are rejected)
  components: 1000, // small lit parts
  barClusters: 420, // clusters of thin cyan bars
  beamStreaks: 900,
  beamBodyStreaks: 150,
  dust: 70,
};

export const SIZES = {
  boardHalf: 15, // board is 30 x 30 units, chip frame is 1.3 units
  grid: 0.05, // routing grid
  frameHalf: 0.66,
  frameWidth: 0.026,
  dieHalf: 0.5,
  dieHeightStart: 0.035,
  dieHeightEnd: 0.27,
  beamHeight: 11,
  beamHalf: 0.47,
};

export type Palette = {
  name: string;
  boardBase: string; // albedo of the board
  boardAmbient: string; // faint fill so the board never goes fully black
  keyLight: string; // light thrown by the glowing frame
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
  boardAmbient: "#3a4662",
  keyLight: "#2a8cff",
  beamLight: "#19c8d8",
  frame: "#3a8cff",
  traceDim: "#3a6088",
  traceLit: "#8fb8e8",
  pins: "#d7ecff",
  component: "#cfe6ff",
  bars: "#35d6e6",
  accent: "#2fe0c8",
  dieGlow: "#2aa5e8",
  beamCore: "#14b0d8",
  beamTop: "#08b4d8",
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
  boardBase: "#5e4033",
  boardAmbient: "#200f0b",
  keyLight: "#ff5a1f",
  beamLight: "#ffc21a",
  frame: "#ff6a2a",
  traceDim: "#9a5a3a",
  traceLit: "#ffd9a8",
  pins: "#fff0d7",
  component: "#ffe9cf",
  bars: "#ffb035",
  accent: "#3cc8ff",
  dieGlow: "#f08a2a",
  beamCore: "#ff7a2f",
  beamTop: "#ffc612",
  beamHot: "#fff6a0",
  dust: "#ffd24a",
  haze: "#d8481f",
  fog: "#0a0403",
  gradeLift: [0.024, 0.014, 0.012],
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
  { t: 0.0, az: 0, el: 26, dist: 12.6, roll: 0, tx: 0.1, ty: 0, tz: 0.3 },
  { t: 0.5, az: 0, el: 26, dist: 8.4, roll: 0, tx: 0.1, ty: 0, tz: 0.3 },
  { t: 1.0, az: 0, el: 27, dist: 4.4, roll: 0, tx: 0.05, ty: 0, tz: 0.3 },
  { t: 1.6, az: 0, el: 32, dist: 4.4, roll: 0, tx: 0.0, ty: 0, tz: 0.25 },
  { t: 2.5, az: -1, el: 37, dist: 4.6, roll: 0, tx: 0.0, ty: 0, tz: 0.2 },
  { t: 4.0, az: -5, el: 37, dist: 4.6, roll: -3, tx: -0.05, ty: 0, tz: 0.2 },
  { t: 7.0, az: -20, el: 31, dist: 4.6, roll: -12, tx: -0.2, ty: 0, tz: 0.3 },
  { t: 10.0, az: -35, el: 24, dist: 4.6, roll: -21, tx: -0.35, ty: 0, tz: 0.4 },
  { t: 12.0, az: -43, el: 21, dist: 4.6, roll: -26, tx: -0.45, ty: 0, tz: 0.45 },
  { t: 14.67, az: -52, el: 18, dist: 4.6, roll: -32, tx: -0.55, ty: 0, tz: 0.5 },
];
