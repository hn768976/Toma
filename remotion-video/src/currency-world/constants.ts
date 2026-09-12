// Geometry, timing and camera config for the 3D currency-exchange field.
//
// Everything here is authored in "design space": a 1920x1080 frame. The
// composition scales that whole space by (outputWidth / BASE_WIDTH), so
// the 4K compositions are pixel-for-pixel the same shot as the 1080p
// ones, just rasterised larger.

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

export const FPS = 30;

// The reference plate is 12.017 s. 12.017 * 30 = 360.5, so 361 frames
// (12.033 s) is the closest 30 fps match.
export const DURATION_IN_FRAMES = 361;

// --- Camera ---------------------------------------------------------

// CSS `perspective`, in design px. 1500 over a 1920 frame is a ~65 deg
// horizontal FOV: wide enough for aggressive foreshortening on the
// depth-aligned streaks without the fish-eye of a shorter lens.
export const PERSPECTIVE = 1500;

// The depth slab the field lives in. Elements travel from Z_FAR towards
// Z_NEAR as the camera dollies in, then wrap back — both ends are inside
// a fade so the recycle is never visible.
export const Z_NEAR = -260;
export const Z_FAR = -7200;
export const Z_SPAN = Z_NEAR - Z_FAR;

// Fade bands at each end of the slab.
export const FADE_IN_DEPTH = 1500; // from Z_FAR inwards
export const FADE_OUT_DEPTH = 950; // before Z_NEAR

// Depth of the focal plane. Anything nearer or further defocuses.
export const FOCUS_Z = -2600;
export const BLUR_NEAR_GAIN = 0.0075; // screen px of blur per px nearer than focus
export const BLUR_FAR_GAIN = 0.0009; // ... per px further than focus
export const MAX_SCREEN_BLUR = 9;

// Lateral extent of the field, in design px at z = 0.
export const SPREAD_X = 6200;
export const SPREAD_Y = 3500;

// Camera travel, in design px per second at z = 0.
export const PAN_SPEED = 105; // sideways — the shot's main move
export const DOLLY_SPEED = 110; // forwards, into the field
export const BOB_AMPLITUDE_X = 26;
export const BOB_AMPLITUDE_Y = 34;
export const YAW_DEGREES = 0.9; // slight lead into the pan direction
export const ROLL_DEGREES = 0.35;

// --- Population -----------------------------------------------------

export const MEDALLION_COUNT = 150;
export const PRICE_TAG_COUNT = 175;
export const STREAK_COUNT = 48;
export const HUD_COUNT = 60;
export const SPARK_COUNT = 140;

export const CURRENCY_GLYPHS = ["$", "€", "£", "¥", "₽"];

// Quantised so ticker values read as a live feed without every tag being
// a unique string (the reference plate reuses a small set too).
export const TICKER_VALUES = [
  "16.19", "25.83", "31.33", "33.45", "34.92", "37.26", "42.10", "47.85",
  "47.98", "52.89", "54.59", "58.82", "61.22", "61.67", "62.31", "65.65",
  "67.03", "71.79", "72.04", "72.31", "75.62", "75.83", "76.76", "84.16",
  "84.28", "84.72", "95.55", "96.47", "20.78", "29.19",
];
