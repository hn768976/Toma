/**
 * Global constants for the light-mode crypto terminal.
 *
 * Everything here is frame-independent. All motion is derived in `scene.ts`
 * from the frame number alone, so a render is bit-for-bit deterministic.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 60;
export const DURATION = 1620; // 27.0s — one full loop period

/** Print-like palette. Nothing here is emissive; the screen is paper-white. */
export const COLORS = {
  bg: '#FFFFFF',
  green: '#26A66A',
  red: '#D9455C',
  blue: '#2D6FD9',
  text: '#3A4048',
  rule: '#E4E7EB',
  mid: '#9AA3AE',
} as const;

// ── Price series ───────────────────────────────────────────────────────────

/** Number of candles in one seamless period. The scroll covers exactly this. */
export const SERIES_LEN = 260;
/** Candle body width and gap, in design-space pixels. */
export const BODY_W = 22;
export const GAP = 8;
/** 30px pitch at 6 frames per candle — the spec's one-candle-per-6-frames. */
export const PITCH = BODY_W + GAP;
export const WICK_W = 3;

// ── Geometry vs. axis: why they are decoupled ─────────────────────────────
//
// The candle *geometry* is built to tile exactly: candle j at scroll s lands on
// the same pixel as candle j+SERIES_LEN at scroll s+SERIES_LEN, so frame 0 and
// frame 1620 are pixel-identical.
//
// The *displayed* price axis is a separate mapping that ramps 4,000 -> 60,000
// across the loop and eases back over the final 120 frames. Tying the numbers
// to the geometry would force either a flat axis or a broken loop; keeping them
// separate buys both a steady rising staircase and a climbing axis, and the
// difference is unmeasurable behind 30px of blur.

/** Design-space rise per candle of the trend line — sets the staircase angle. */
export const SLOPE_PX = 12;
/** Design-space pixels per unit of log-price for the candle wiggle. */
export const PX_PER_LOG = 3000;

/** Price at the y-anchor line at t=0, and the axis growth over one loop. */
export const BASE_PRICE = 4180;
export const AXIS_GROWTH = Math.log(11);
/** Design-space pixels per unit of log-price for the *displayed* axis. */
export const K_LABEL = 7200;
/** Same, for the heavily cropped oversized axis on the far right. */
export const K_FAR = 12200;
/** Frame at which the axis ramp turns around to close the loop. */
export const AXIS_RETURN_FRAME = 1500;

// ── Layout (design space, pre-camera-transform) ────────────────────────────
//
// The camera transform rotates and scales this space, so content is authored
// well outside the 3840x2160 box — the frame is a macro crop of a larger UI.

export const LAYOUT = {
  /** x of the price axis: where the newest (forming) candle sits. */
  axisX: 1604,
  /** Grid rules run from here to gridRight. */
  chartLeft: -400,
  gridRight: 1855,
  /** Design y that the current axis price maps to. */
  yAnchor: 620,
  /** Volume histogram: a fixed baseline at the foot of the chart panel. The
   *  camera tilt is what makes the band drop away toward the right. */
  volumeBase: 1430,
  volumeMax: 210,
  /** Right-aligned x for the y-axis numeric labels. */
  labelRight: 1845,
  /** Vertical panel dividers. */
  divider1: 1875,
  divider2: 2140,
  /** Sidebar panel content. */
  sidebarX: 1900,
  /** Far-right cropped axis column. */
  farAxisX: 2170,
} as const;

/**
 * Design-space height of the frame at the current camera scale. Used to pick a
 * grid step that gives a sensible number of rules *in shot*, rather than across
 * the whole (much larger) design surface.
 */
export const VISIBLE_H = 1216;

// ── Camera ────────────────────────────────────────────────────────────────

// Off-axis tilt, measured off the reference footage rather than guessed:
// horizontal rules and text run ~3.6 degrees DOWNHILL to the right, while
// verticals lean ~11 degrees with their tops to the right. A single rotation
// cannot produce both, so the rotation carries the 3.6 and a horizontal shear
// carries the rest. Parallel lines stay parallel — this is not a projection.
export const CAM_ROTATION = (3.6 * Math.PI) / 180;
/** Horizontal shear (y feeds x): the source of the strong vertical lean. */
export const CAM_SHEAR_X = -0.135;
/** Vertical shear (x feeds y) — a touch of keystone. */
export const CAM_SHEAR_Y = 0.01;
/** Macro magnification. Also the overscan that keeps the corners covered. */
export const CAM_SCALE = 2.0;
/** Design-space point pinned to the frame centre. */
export const CAM_ANCHOR = {x: 1400, y: 900} as const;

// ── Depth of field ────────────────────────────────────────────────────────

/** Blur radii of the three composite buffers, in device pixels. */
export const BLUR_FAR = 30;
export const BLUR_MID = 11;
export const BLUR_SHARP = 0;
