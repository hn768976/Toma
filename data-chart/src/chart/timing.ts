/**
 * The timing sheet. Every beat below is expressed in frames at COMP_FPS and is
 * read by exactly one component, so retiming the build is a local edit.
 *
 *   0–20    dashed Y axis wipes up, dashed X axis wipes right (easeOutCubic)
 *  15–45    Y labels fade in bottom-to-top, ~2 frames apart
 *  30–90    vertical grid lines draw downward, staggered left to right;
 *           horizontals fade in behind them
 *  25–70    title types on, then the two subtitle lines
 *  60–270   the series draws left to right at a steady (linear) pace
 * 270–600   hold, with a slow ±5% glow pulse on the series
 */

export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;
export const COMP_FPS = 30;
export const COMP_DURATION = 600;

export const AXIS_WIPE = { start: 0, end: 20 };

export const Y_LABELS = {
  start: 15,
  /** Frames between one label and the next, bottom label first. */
  stagger: 2,
  fade: 12,
};

export const GRID = {
  start: 30,
  end: 90,
  /** How long a single vertical line takes to draw from top to baseline. */
  draw: 18,
  /** Horizontals cross-fade inside this window, behind the verticals. */
  horizontalStart: 32,
  horizontalFade: 20,
};

export const TITLE_TYPE = { start: 25, end: 52 };
export const SUBTITLE_TYPE = { start: 52, end: 70 };

export const SERIES = {
  start: 60,
  end: 270,
  /** Bar variant: how long one bar takes to grow once it starts. */
  barGrow: 45,
};

/** An X label fades in as the series crosses its column. */
export const X_LABEL_FADE = 10;

export const GLOW_PULSE = {
  /** Full cycle length in frames. */
  period: 90,
  /** ±amplitude around 1. */
  amount: 0.05,
};
