// Timing and geometry for the "candle close-up" family of compositions.
//
// Everything here is authored at 4K (3840x2160), the size the three
// compositions are registered at. A resolutionScale prop scales the whole
// scene down for previews without changing any of the ratios.

export const FPS = 30;

// 390 frames @ 30fps = 13.0s, seamless loop. Every periodic motion below
// has a period that divides 390 exactly so frame 390 lands back on the
// state of frame 0.
export const DURATION_IN_FRAMES = 390;

export const BASE_WIDTH = 3840;
export const BASE_HEIGHT = 2160;

// --- Chart geometry -------------------------------------------------------
//
// The tight crop is the defining feature of this family: exactly
// VISIBLE_CANDLES candles span the frame, so each one is large and
// individually legible. The scroll advances one candle every
// FRAMES_PER_CANDLE frames, and DURATION_IN_FRAMES / FRAMES_PER_CANDLE ==
// VISIBLE_CANDLES, which is what makes the loop close: over one loop the
// series translates by exactly one tile.
export const VISIBLE_CANDLES = 30;
export const FRAMES_PER_CANDLE = 13;

// Slot pitch, and the body/gap split within it. The 68.6 / 31.4 body-to-gap
// ratio is the specified 48px body + 22px gap, scaled up so that
// VISIBLE_CANDLES slots fill the 3840px frame.
export const CANDLE_PITCH = BASE_WIDTH / VISIBLE_CANDLES; // 128px
export const BODY_WIDTH = Math.round(CANDLE_PITCH * 0.686); // 88px
export const CANDLE_GAP = CANDLE_PITCH - BODY_WIDTH; // 40px
export const WICK_WIDTH = 9;

// One tile of the series is exactly the visible width, so the scroll
// distance over a full loop is one tile.
export const SERIES_WIDTH = CANDLE_PITCH * VISIBLE_CANDLES;

// --- The forming candle ---------------------------------------------------
//
// The newest candle keeps moving until the scroll locks it. FORM_ANCHOR_PX
// is how far in from the right edge a candle has to travel before it is
// considered locked — a bit over one slot, so the candle that is still
// moving is fully on-screen rather than half-cropped by the frame edge.
export const FORM_ANCHOR_PX = CANDLE_PITCH * 1.35;

// --- Depth of field -------------------------------------------------------
//
// A focal band across the middle of the frame; candles soften toward the
// left and right edges. Deliberately gentle — these read as graphic, not
// photographic.
export const DOF_MAX_BLUR = 16;
export const DOF_FOCAL_HALF_WIDTH = 0.26; // fraction of width kept fully sharp
export const DOF_FALLOFF = 0.24; // fraction of width over which blur ramps in

// --- Backdrop grid --------------------------------------------------------
export const GRID_COLUMN_PITCH = CANDLE_PITCH * 2; // 256px; divides SERIES_WIDTH
export const GRID_ROW_PITCH = 180;
export const GRID_LINE_WIDTH = 2;

// --- Glow (dark variants) -------------------------------------------------
export const GLOW_TIGHT_BLUR = 20;
export const GLOW_WIDE_BLUR = 64;

// --- Soft shadow (light variant) ------------------------------------------
export const SHADOW_BLUR = 26;
export const SHADOW_OFFSET_Y = 14;

// --- Ambient camera drift -------------------------------------------------
// A closed elliptical path, one revolution per loop. This is the only
// camera move: no tilt, no shear, no zoom.
export const AMBIENT_DRIFT_X = 8;
export const AMBIENT_DRIFT_Y = 8;

export const MONO_FONT_STACK =
  '"DejaVu Sans Mono", "Liberation Mono", "SF Mono", Menlo, Consolas, monospace';
