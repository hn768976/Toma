// Timing, geometry and layout constants for the "Global Data Network" board.
//
// Everything is authored in a fixed 1920x1080 *design space*; the renderer
// scales that space to whatever the composition's real width is, so the 1080p
// and 4K compositions are pixel-identical apart from resolution.

export const FPS = 30;

/** 20.000s at 30fps — same length as the reference clip. */
export const DURATION_IN_FRAMES = 600;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

/**
 * The dashboard "table" is far larger than the frame — the camera only ever
 * sees a slice of it, which is what sells the depth.
 */
export const BOARD_W = 8200;
export const BOARD_H = 6600;

/** Aspect of public/world-dots.png (7040 x 2528). */
export const MAP_ASPECT = 2528 / 7040;
export const MAP_W = 5600;
export const MAP_H = MAP_W * MAP_ASPECT;
export const MAP_X = (BOARD_W - MAP_W) / 2;
export const MAP_Y = BOARD_H * 0.44 - MAP_H / 2;

/** Latitude/longitude window baked into public/world-dots.png. */
export const MAP_LON_MIN = -180;
export const MAP_LON_MAX = 180;
export const MAP_LAT_MAX = 73;
export const MAP_LAT_MIN = -56;

/**
 * Camera rig, in design units / degrees. The board sits `distance` behind the
 * lens and is projected by `perspective`, so pulling the distance in over the
 * clip is a real dolly rather than a 2D zoom.
 */
export const CAMERA = {
  perspective: 1500,
  perspectiveOrigin: "50% 30%",
  distanceStart: 2500,
  distanceEnd: 2170,
  tiltStart: 60.5,
  tiltEnd: 58.4,
  rollStart: -6.4,
  rollEnd: -4.2,
  /** Slide along the table surface: x = sideways, y = toward the horizon. */
  panStart: 640,
  panEnd: -640,
  dollyStart: 300,
  dollyEnd: -300,
} as const;
