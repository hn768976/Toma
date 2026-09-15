/**
 * Geometry and timing, all authored in a 1920x1080 "design space".
 * Every composition renders this design space scaled to its own size,
 * so 1080p and 4K are pixel-identical apart from resolution.
 *
 * Measured off the reference clip (596x336, 30fps, 17.000s), scaled up:
 *   - the eraser gap wraps on frames 96 / 277 / 458   -> 181-frame cycle
 *   - the trace band runs the full width of the panel with a travelling gap
 *   - R-R spacing measures ~258px in design space
 */

export const FPS = 30;
/** 17.000s at 30fps - identical length to the reference clip. */
export const DURATION_IN_FRAMES = 510;

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

// ---------------------------------------------------------------- ECG sweep

export const TRACE_X0 = 169;
export const TRACE_X1 = 1289;
export const TRACE_W = TRACE_X1 - TRACE_X0;
export const BASELINE_Y = 652;

/** Frames for the cursor to cross the band once, then wrap. */
export const SWEEP_FRAMES = 181;
export const SWEEP_SPEED = TRACE_W / SWEEP_FRAMES; // ~6.19 px/frame

/** Distance between R spikes, taken straight off the reference. */
export const BEAT_PX = 258;

/** Height of the R spike above baseline. */
export const R_AMPLITUDE = 290;

/** Blank window the cursor pushes ahead of itself, erasing the old trace. */
export const ERASER_PX = 255;

/** How much the oldest end of the trace has dimmed by, just before erasure. */
export const AGE_FADE = 0.3;

// ------------------------------------------------------------ Panel layout

/** The two stacked marker squares on the far left. */
export const LEFT_MARKS = [
  {x: 153, y: 403, w: 48, h: 56},
  {x: 153, y: 757, w: 72, h: 49},
] as const;

/** Grey "battery" block left of the heart-rate number. */
export const GREY_BAR = {x: 1313, y: 194, w: 113, h: 273} as const;

/** Small lit tab sitting on the top-left shoulder of the grey block. */
export const GREY_TAB = {x: 1313, y: 155, w: 40, h: 44} as const;

export const HR_NUMBER = {
  x: 1450,
  baselineY: 483,
  fontSize: 414,
  scaleX: 0.76,
} as const;

export const SUB_NUMBER = {
  x: 1450,
  baselineY: 902,
  fontSize: 224,
  scaleX: 0.8,
} as const;

/** Column of small blocks between the grey bar and the sub readout. */
export const SUB_MARKS = [
  {x: 1296, y: 757, w: 26, h: 24},
  {x: 1296, y: 806, w: 44, h: 28},
  {x: 1296, y: 862, w: 44, h: 28},
  {x: 1296, y: 918, w: 44, h: 28},
] as const;

/** Partially cropped row peeking in at the bottom edge. */
export const BOTTOM_ROW = {
  x: 1450,
  baselineY: 1115,
  fontSize: 210,
  scaleX: 0.8,
} as const;

// -------------------------------------------------------- Depth of field

/**
 * The reference is a macro shot: the focal plane sits over the middle of the
 * trace and everything falls off toward both edges. Blur radii are
 * design-space pixels and scale with the composition.
 */
export const BLUR = {
  traceLeft: 3.4,
  traceCenter: 0.45,
  traceRight: 1.7,
  greyBar: 3.4,
  hrNumber: 4.0,
  subNumber: 5.2,
  bottomRow: 8.0,
  leftMarks: 3.8,
  subMarks: 4.4,
} as const;

/** Focal plane, in design-space x. */
export const FOCUS_X = 880;
export const FOCUS_K = 0.0042;

/** Scanline pitch in design pixels (LCD row structure seen at macro range). */
export const SCANLINE_PITCH = 12;
export const SUBPIXEL_PITCH = 8;
