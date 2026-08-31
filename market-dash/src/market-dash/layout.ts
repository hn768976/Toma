// Every dimension in the piece is expressed in 4K pixels against this
// frame; nothing measures itself against the window.

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 420;

/** Backdrop and grid only, dim. */
export const INTRO_END = 25;
/** Everything advances together between these two frames. */
export const ADVANCE_START = 25;
export const ADVANCE_END = 380;
/** ADVANCE_END..DURATION_IN_FRAMES holds the final state. */

export const PAD_LEFT = 190;
export const PAD_RIGHT = 190;

/** The horizontal region the line series travel across. */
export const PLOT_X0 = PAD_LEFT;
export const PLOT_X1 = WIDTH - PAD_RIGHT;
export const PLOT_WIDTH = PLOT_X1 - PLOT_X0;

/** The vertical region the line series' bands are packed into. */
export const PLOT_Y0 = 230;
export const PLOT_Y1 = 1400;

/** The bar row stands on this line and grows upward from it. */
export const BAR_BASELINE = 1800;
export const BAR_MAX_HEIGHT = 300;
export const BAR_X0 = PAD_LEFT;
export const BAR_X1 = WIDTH - PAD_RIGHT;

/** The thin bright rail sits just under the baseline and bows gently. */
export const RAIL_OFFSET = 18;
export const RAIL_BOW = 34;

/** The timeline axis occupies the very bottom of the frame. */
export const AXIS_TOP = 1900;
export const AXIS_RULE_Y = 1952;
export const AXIS_QUARTER_Y = 2020;
export const AXIS_YEAR_Y = 2108;
export const AXIS_HEIGHT = HEIGHT - AXIS_TOP;

/**
 * Quarter cells are sized so the whole range is about 2.6 frame widths of
 * axis. A short range gets wide quarters (capped, or a five-year span would
 * show two labels); a long range compresses them, which is what makes the
 * axis appear to scroll faster without changing the scroll speed in pixels.
 */
export const axisQuarterWidth = (quarters: number) =>
  Math.max(150, Math.min(420, (WIDTH * 2.6) / quarters));

/** How many samples each series carries across the full range. */
export const seriesPointCount = (quarters: number) =>
  Math.max(200, Math.min(280, quarters * 12));
