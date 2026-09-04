/**
 * Corridor geometry and timing.
 *
 * Everything the renderer draws is a pure function of `useCurrentFrame()`.
 * There is no `useFrame` clock and no delta accumulation anywhere in this
 * project, because Remotion renders frames out of order across threads.
 */

export const FPS = 30;
export const DURATION_IN_FRAMES = 300; // 10s
export const WIDTH = 3840;
export const HEIGHT = 2160;

// --- Corridor cross-section (world units) ---------------------------------
// The reference corridor is noticeably wider than it is tall (~5:3).
export const HALF_WIDTH = 2.5;
export const HEIGHT_UNITS = 3.0;

// --- Corridor depth -------------------------------------------------------
/** Neon rectangles alive at any moment. */
export const FRAME_COUNT = 26;
/**
 * World-space gap between consecutive rectangles.
 *
 * Only the product SPACING * tan(fov/2) sets how the corridor stacks up on
 * screen. Measuring the reference — near frame uprights at 24%/77% of width,
 * its top bar 7% from the top, successive top bars converging by a fixed
 * ratio — pins that product at ~0.70, which is what this pair is chosen to
 * hit. Change one and you must change the other.
 */
export const SPACING = 2.03;
/**
 * Z of slot 0. Positive means "just behind the camera", which is where the
 * back-to-front recycling happens, so a tube is never seen popping.
 */
export const Z_SLOT0 = 0.5;
export const CORRIDOR_DEPTH = FRAME_COUNT * SPACING;

// --- Tubes ----------------------------------------------------------------
export const TUBE_THICKNESS = 0.07;

// --- Camera ---------------------------------------------------------------
/**
 * Eye height. Measured off the reference: its near frame puts the floor line
 * at 25% of the image below centre and the ceiling at 87% above, which pins
 * the camera at ~22% of the corridor height. Low, so the floor — and so the
 * reflection — carries the frame.
 */
export const CAMERA_Y = 0.68;
export const CAMERA_FOV = 38; // vertical; see SPACING
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 120;

/** Camera float amplitude, in world units. Under 1% of the frame. */
export const FLOAT_X = 0.022;
export const FLOAT_Y = 0.016;

// --- Atmosphere -----------------------------------------------------------
export const FOG_DENSITY = 0.022;
/** Depth at which the neon colour ramp has fully reached its far end. */
export const RAMP_DEPTH = 16;
