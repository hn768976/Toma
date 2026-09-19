/**
 * Geometry, timing and layout for the "Generate" button / circuit-burst
 * motion graphic.
 *
 * Everything in this file is authored in a fixed 1920x1080 design space.
 * The scene is rendered by scaling that design space to whatever the
 * composition's real size is (`designScale` in the scene component), so the
 * exact same numbers produce a pixel-identical 1080p and 4K master.
 */

export const FPS = 30;
export const DURATION_IN_FRAMES = 600; // 20s, matching the reference.

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;
export const CENTER_X = BASE_WIDTH / 2;
export const CENTER_Y = BASE_HEIGHT / 2;

// --- Button geometry, at camera scale 1 (the opening "hero" size) ---------
// Measured off the reference and converted from its 898px-wide frame.
export const RING_WIDTH = 842;
export const RING_HEIGHT = 334;
export const RING_RADIUS = 141;
export const RING_STROKE = 7;

export const BODY_WIDTH = 742;
export const BODY_HEIGHT = 252;
export const BODY_RADIUS = BODY_HEIGHT / 2;

export const HAIRLINE_WIDTH = 644;
export const HAIRLINE_HEIGHT = 197;
export const HAIRLINE_RADIUS = HAIRLINE_HEIGHT / 2;
export const HAIRLINE_STROKE = 2.6;

export const LABEL_FONT_SIZE = 91;
export const LABEL_FONT_FAMILY = "Generate Sans, Arial, Helvetica, sans-serif";

// --- Camera -------------------------------------------------------------
// The shot opens tight on the button, then pulls back to its resting size
// once the cursor clicks. 0.538 is the measured ratio of the reference's
// resting button width to its opening width.
export const CAMERA_SCALE_START = 1;
export const CAMERA_SCALE_REST = 0.538;
export const ZOOM_START_FRAME = 33;
export const ZOOM_END_FRAME = 55;

// --- Cursor -------------------------------------------------------------
// The arrow is a screen-space overlay: it does NOT ride the camera pull-back,
// it simply holds its landing spot and fades out (as in the reference).
export const CURSOR_WIDTH = 90;
export const CURSOR_HEIGHT = 94;
export const CURSOR_ENTER_FRAME = 6;
export const CURSOR_ARRIVE_FRAME = 32;
export const CURSOR_TIP_START_Y = 1097; // just below the bottom edge
export const CURSOR_TIP_END_Y = 616;
export const CURSOR_TIP_PRESSED_Y = 631; // small dip on the click
export const CURSOR_FADE_START = 50;
export const CURSOR_FADE_END = 58;

export const CLICK_FRAME = 33;

// --- Circuit field ------------------------------------------------------
export const TRACE_FADE_IN_START = 90;
export const TRACE_FADE_IN_END = 118;

// A brightness wave sweeps outward from the button as the field lights up.
// 15.4 design-px/frame is the speed measured off the reference.
export const WAVE_START_FRAME = 101;
export const WAVE_SPEED = 15.4;
export const WAVE_WIDTH = 300;
export const WAVE_FADE_OUT_START = 165;
export const WAVE_FADE_OUT_END = 215;

/** Traces are generated out to here so nothing pops in at the frame edge. */
export const FIELD_RADIUS = 1420;

export const BUNDLE_COUNT = 820;
export const FRAGMENT_COUNT = 860;
export const TRACE_SEED = 20250919;
