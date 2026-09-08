/**
 * Composition-level constants and the build timeline.
 *
 * Compositions are authored at 3840x2160 so they can be rendered at 4K
 * later; every world-space measurement below is resolution independent and
 * the orthographic frustum is derived from useVideoConfig(), so the framing
 * is identical at 1080p and 4K.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 600;

/** Height of the orthographic frustum in world units. Width follows the aspect. */
export const VIEW_HEIGHT = 9.3;

/** Point the camera is aimed at, in world units. */
export const VIEW_TARGET: [number, number, number] = [-0.05, 1.45, 0.3];

/**
 * True isometric: an orthographic camera at 45 degrees of azimuth and
 * atan(1 / sqrt(2)) = 35.264 degrees of elevation, i.e. looking down the
 * (1, 1, 1) diagonal. Parallel edges stay parallel; that is the whole look.
 */
export const CAMERA_DIRECTION: [number, number, number] = [1, 1, 1];
export const CAMERA_DISTANCE = 60;

/** Screen-horizontal ground direction for the orthographic pan. */
export const PAN_AXIS: [number, number, number] = [1, 0, -1];

// --- Facility dimensions (world units, roughly metres) ---------------------

export const TILE = 0.6;
/** Floor grid runs from -GRID_HALF to +GRID_HALF tiles in both directions. */
export const GRID_HALF = 23;

export const RACK_W = 0.6;
export const RACK_D = 1.05;
export const RACK_H = 2.05;
export const RACK_PITCH = 0.615;
export const ROW_PITCH = 2.2;
export const ROWS = 5;

export const TRAY_Y = RACK_H + 0.5;
export const CEILING_Y = 3.7;

// --- Build timeline (frames) ----------------------------------------------

export const T = {
  /** Floor tiles fade up in a wave from the front of the frame. */
  floorStart: 0,
  floorWave: 26,
  floorFade: 14,

  /** Racks rise from zero height, row by row and along each row. */
  rackStart: 30,
  rackRowStagger: 17,
  rackColStagger: 3.6,
  rackRise: 26,

  /** Unit divisions draw in, then LEDs light in staggered bursts. */
  unitStart: 150,
  unitRackStagger: 1.5,
  unitLineStagger: 0.35,
  unitDraw: 9,

  ledStart: 188,
  ledRackStagger: 2.1,
  ledStagger: 0.9,
  ledOn: 5,

  /** Cable trays extend along the row tops, then the bundles sweep in. */
  trayStart: 250,
  trayRowStagger: 11,
  trayDraw: 30,

  cableStart: 298,
  cableRowStagger: 12,
  cableSweep: 34,
  cableSagDelay: 12,
  cableSag: 26,

  /** Vertical drops connect, ceiling strips fade on. */
  dropStart: 352,
  dropStagger: 6,
  dropDraw: 22,

  ceilingStart: 382,
  ceilingStagger: 9,
  ceilingFade: 30,

  propStart: 96,
  propStagger: 13,
  propRise: 24,

  /** Data pulses start once the facility is standing. */
  pulseStart: 430,
} as const;
