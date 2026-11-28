/**
 * chip-ignite - everything you are likely to want to change lives here:
 * format, timings, colours, the two camera moves and the part counts.
 * (Light, bloom, lens and grain settings are in src/look.ts.)
 */

export const SHORT_NAME = "chip-ignite";

/* ---- format -------------------------------------------------------------- */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** reference: 13.6 s (340 frames at 25 fps) -> round(13.6 * 30) = 408 frames */
export const DURATION_IN_FRAMES = 408;

/* ---- colours ------------------------------------------------------------- */
export const PALETTE = {
  /** glowing lines after the chip ignites */
  glow: "#ffa050",
  glowHot: "#ffd0a0",
  /** the small chip when it starts to glow */
  chipGlow: "#ff3a00",
  /** the flare in the centre */
  flareCore: "#fff1dc",
  flareHalo: "#ffb070",
  /** light the ignited chip throws onto the package */
  ignitionLight: "#ffa050",
  gold: "#a08652",
  bronze: "#6a5228",
  silver: "#dcdcda",
  led: "#ff9a3a",
  /** pale gold of the lines that spread over the board */
  boardGlow: "#ffb264",
  ledRed: "#ff2a12",
};

/* ---- timings (seconds) --------------------------------------------------- */
export const TIMING = {
  /** height of the small chip above its seat, cm: [time, height] */
  chipDrop: [[0, 17.5], [2.2, 9.0], [5.0, 1.0], [5.7, 0]] as [number, number][],
  /** the four indicator LEDs fade in while the chip comes down */
  ledsFrom: 3.2,
  ledsTo: 5.6,
  /** the chip starts to glow, then the flare bursts */
  glowFrom: 6.0,
  glowTo: 6.4,
  flareFrom: 6.4,
  flarePeak: 6.8,
  /** glowing lines spread over the tiles: [time, radius in cm] */
  tileReveal: [[6.65, 1.0], [8.4, 9.0]] as [number, number][],
  /** ...and on across the board */
  boardReveal: [[8.4, 9.5], [10.5, 19], [13.6, 36]] as [number, number][],
  /** edge light strips of the package */
  edgeFrom: 7.0,
  edgeTo: 8.2,
  /** overall exposure over time (the shot opens up as the camera cranes up) */
  exposure: [[0, 0.9], [4, 1.1], [8.4, 1.05], [13.6, 0.98]] as [number, number][],
  /** after the burst the whole package keeps getting brighter: [time, level] */
  swell: [[6.8, 1], [13.6, 2.6]] as [number, number][],
};

/* ---- camera -------------------------------------------------------------- */
export interface CameraMove {
  /** orbit angle around the package, degrees: [time, value] */
  azimuth: [number, number][];
  /** height angle above the board, degrees */
  elevation: [number, number][];
  /** distance from the target, cm */
  distance: [number, number][];
  /** camera roll, degrees */
  roll: [number, number][];
  /** look-at point on the board (x, y), cm */
  targetX: [number, number][];
  targetY: [number, number][];
  fov: number;
}

/** Version 1 - the reference move: slow orbit while craning up and back. */
export const CAMERA_V1: CameraMove = {
  azimuth: [[0, 33], [13.6, 49]],
  elevation: [[0, 38], [6.8, 58], [13.6, 72]],
  distance: [[0, 29], [6.8, 28.5], [13.6, 34]],
  roll: [[0, 0], [13.6, 0]],
  targetX: [[0, -0.5], [6.8, 1.6], [13.6, 0.4]],
  targetY: [[0, 1.0], [6.8, -2.0], [13.6, -0.4]],
  fov: 38,
};

/**
 * Version 2 - a different camera movement: starts high and wide, square to
 * the package, then spirals down the other way and pushes in on the chip.
 */
export const CAMERA_V2: CameraMove = {
  azimuth: [[0, 8], [13.6, -58]],
  elevation: [[0, 72], [6, 54], [13.6, 36]],
  distance: [[0, 36], [6.5, 29], [13.6, 22]],
  roll: [[0, 0], [13.6, 0]],
  targetX: [[0, 0], [13.6, 0]],
  targetY: [[0, 0], [13.6, 0.4]],
  fov: 38,
};

/* ---- counts / sizes (cm) ------------------------------------------------- */
export const BOARD_SIZE = 72;
export const PACKAGE = {
  base: 19.0,
  mid: 16.6,
  top: 13.4,
  tile: 3.8,
  pitch: 4.1,
  /** heights of the two steps under the tile frame */
  baseH: 1.6,
  midH: 1.4,
  /** height of the tile surface and of the frame bars */
  tileZ: 3.12,
  topZ: 3.54,
  /** size of the small chip that comes down */
  chip: 2.3,
};
export const COUNTS = {
  /** tiny surface-mount parts scattered over the board */
  smallParts: 8000,
  capacitors: 30,
  chips: 16,
  /** glowing lines that spread across the board */
  boardLines: 64,
  /** fan-out lines per tile edge */
  tileLines: 16,
};
export const SEED = 7705;
