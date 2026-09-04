// ---------------------------------------------------------------------------
// Composition + layout metrics.
//
// Everything is authored against a 3840x2160 design size. Each metric below is
// an EVEN number of design pixels so it also lands on a whole pixel when the
// same composition is rendered at --scale=0.5 (1920x1080). If the row height
// were odd the scroll would land on half pixels at one of the two scales and
// the loop would visibly drift.
// ---------------------------------------------------------------------------

export const FPS = 30;
export const DURATION_IN_FRAMES = 420; // 14s
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const TOOLBAR_HEIGHT = 160; // 7.4% of frame height
export const ROW_HEIGHT = 190; // -> 2000 / 190 = 10.5 rows visible
export const LIST_HEIGHT = HEIGHT - TOOLBAR_HEIGHT;

/** Both content sets hold exactly this many subjects. */
export const ROWS_PER_CYCLE = 14;

/** Scroll distance of one full data cycle, in design px. */
export const CYCLE_PX = ROWS_PER_CYCLE * ROW_HEIGHT; // 2660

/**
 * 14 rows over 420 frames = exactly 30 frames per row, which sits inside the
 * "one row every 30-35 frames" target and makes frame 420 identical to frame
 * 0 -- the loop is seamless by construction.
 */
export const FRAMES_PER_ROW = DURATION_IN_FRAMES / ROWS_PER_CYCLE;

/** How many copies of the data array are laid out in the scrolling strip. */
export const CYCLES_RENDERED = 3;
/** Rows kept above the top edge so nothing pops in when the strip is skewed. */
export const LEAD_ROWS = ROWS_PER_CYCLE;

// --- Row column geometry (design px, measured off the references) -----------
export const PAD_X = 150;
export const CHECKBOX_SIZE = 86;
export const STAR_SIZE = 98;
export const ENVELOPE_WIDTH = 142;
export const ENVELOPE_HEIGHT = 100;

export const COL_STAR_X = 340;
export const COL_ENVELOPE_X = 540;
export const COL_FLAG_X = 814;

export const FLAG_FONT_SIZE = 78;
export const SUBJECT_FONT_SIZE = 82;
/** Gap between the end of the flag label and the start of the subject. */
export const FLAG_TO_SUBJECT_GAP = 90;
/** Roboto Mono advance width, in em. Used to size the fixed flag column. */
export const MONO_ADVANCE = 0.6;

// --- Toolbar geometry -------------------------------------------------------
export const TOOLBAR_TRASH_SIZE = 96;
export const TOOLBAR_DOTS_WIDTH = 96;
export const SEARCH_X = 890;
export const SEARCH_RIGHT = 2850;
export const SEARCH_HEIGHT = 104;
export const SEARCH_FONT_SIZE = 66;
export const SEARCH_ICON_SIZE = 58;

// --- Phishing framing -------------------------------------------------------
export const SKEW_PERSPECTIVE = 5200;
export const SKEW_ROTATE_Y = 6; // deg
export const SKEW_ROTATE_Z = 2; // deg

/**
 * The skewed screen is laid out into a box that is *bigger* than the frame
 * rather than being scaled up, so the tilt never crops the toolbar or the
 * checkbox column the way a plain `scale()` overfill does.
 *
 * `top` pushes the toolbar down far enough that the tilted top edge clears the
 * frame on both sides; the strip left above it is plain page colour, which is
 * invisible because the toolbar is page-coloured too and carries only a bottom
 * border. `x` and `bottom` extend the box past the frame so the rotated
 * quadrilateral still covers all four corners, and so the blur slices at the
 * bottom always have real rows to sample.
 */
export const SKEW_BLEED = { top: 150, x: 260, bottom: 400 };
