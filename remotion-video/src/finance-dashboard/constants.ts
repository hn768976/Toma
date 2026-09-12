// Timing, sizing and palettes for the "Financial AI Analytics Dashboard"
// motion graphic. Everything is authored in 1x (1080p) units and scaled
// by `resolutionScale` at render time so the 1080p and 4K compositions
// stay pixel-for-pixel in sync.

export const FPS = 30;
// 10s, matching the reference clip's length.
export const DURATION_IN_FRAMES = 300;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// The dashboard is drawn onto one wide "board" canvas that a virtual
// camera pans across. Board units are 1x pixels.
export const BOARD_WIDTH = 3600;
export const BOARD_HEIGHT = 1600;

// Camera path (board coordinates of the point that sits at the centre of
// the frame). The reference clip is a slow, continuous lateral dolly.
export const CAMERA_START_X = 1180;
export const CAMERA_END_X = 2290;
export const CAMERA_Y = 780;
export const CAMERA_PERSPECTIVE = 2200;
export const CAMERA_ROTATE_Y_START = -26; // degrees, right edge toward viewer
export const CAMERA_ROTATE_Y_END = -9;
export const CAMERA_ROTATE_X = 9;
export const CAMERA_ROTATE_Z = -5;
export const CAMERA_ZOOM = 0.82;

// Glow / depth of field, in 1x px.
export const GLOW_BLUR_PX = 11; // applied on a half-resolution copy, so ~22px effective
export const DOF_BLUR_PX = 5; // same, ~14px effective
export const DOF_CLEAR_RADIUS_X = 1150;
export const DOF_CLEAR_RADIUS_Y = 470;

export const FONT_FAMILY = "Share Tech Mono";

export type Theme = {
  name: string;
  background: string;
  haze: string;
  // Three accent hues used for data series, ribbons and matrix cells.
  a: string; // reference: red-orange
  b: string; // reference: blue
  c: string; // reference: green
  text: string;
  textDim: string;
  grid: string;
  gridStrong: string;
};

export const REFERENCE_THEME: Theme = {
  name: "reference",
  background: "#02060c",
  haze: "rgba(20, 60, 120, 0.10)",
  a: "#ff5a2e",
  b: "#2f8dff",
  c: "#33e3a2",
  text: "#dbe9ff",
  textDim: "#5e88c4",
  grid: "#0c2440",
  gridStrong: "#174270",
};

export const DARK_CYAN_THEME: Theme = {
  name: "dark-cyan",
  background: "#010a0f",
  haze: "rgba(0, 90, 110, 0.10)",
  a: "#22e6ff", // bright cyan
  b: "#17a6cc", // deep cyan
  c: "#9dfff0", // pale aqua
  text: "#d8fbff",
  textDim: "#3f8d9c",
  grid: "#062a33",
  gridStrong: "#0c4c5a",
};

export const THEMES: Record<string, Theme> = {
  reference: REFERENCE_THEME,
  "dark-cyan": DARK_CYAN_THEME,
};
