/**
 * Shared geometry, depth and palette constants for the code flythrough.
 *
 * Everything in this file is resolution-agnostic in spirit but tuned for the
 * 3840x2160 backing store the composition renders at.
 */

export const FPS = 60;
export const DURATION = 540; // 9.0s @ 60fps, seamless
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const CX = WIDTH / 2;
export const CY = HEIGHT / 2;

/**
 * THE DIAGONAL. Every element shares this axis: it is rotated to it and it
 * drifts along it. -28 degrees from horizontal.
 */
export const DIAG_DEG = -28;
export const DIAG_RAD = (DIAG_DEG * Math.PI) / 180;

/** Unit vector along the diagonal, pointing up-right on screen. */
export const AX = Math.cos(DIAG_RAD); //  0.8829
export const AY = Math.sin(DIAG_RAD); // -0.4695

/** Unit vector perpendicular to the diagonal. */
export const PX = -Math.sin(DIAG_RAD); //  0.4695
export const PY = Math.cos(DIAG_RAD); //  0.8829

/** Elements travel toward down-left, i.e. the negative axis direction. */
export const MOTION_X = -AX;
export const MOTION_Y = -AY;

/**
 * Projection of the visible rectangle onto the two axes. An element has to
 * cover AXIS_VIEW plus its own length to go from fully off one side to fully
 * off the other.
 */
export const AXIS_VIEW = WIDTH * Math.abs(AX) + HEIGHT * Math.abs(AY); // ~4404
export const PERP_VIEW = WIDTH * Math.abs(PX) + HEIGHT * Math.abs(PY); // ~3708

/** Perpendicular spread the field is scattered across. */
export const PERP_SPREAD = PERP_VIEW + 780;

/** Per-element rotation jitter, in degrees. More than this breaks the stream. */
export const ROT_JITTER_DEG = 4;

/** Depth range. */
export const Z_MIN = 0.15;
export const Z_MAX = 1.0;

/** The sharp focal band. Deliberately narrow: only ~20% of the field is crisp. */
export const Z_FOCUS = 0.42;
export const FOCUS_BAND = 0.075;

export const FAR_BLUR_MAX = 5; // screen px at z = Z_MIN
export const NEAR_BLUR_MAX = 38; // screen px at z = Z_MAX

/** scale = z * MAX_SCALE */
export const MAX_SCALE = 3.6;

/** speed = z * BASE_SPEED, in px per frame. */
export const BASE_SPEED = 48;

/** Native (unscaled) type size for code and binary. */
export const FONT_PX = 36;
export const LINE_HEIGHT = 1.42;

/** Sprites are rasterised at most this large, then upscaled at draw time. */
export const MAX_RENDER_SCALE = 1.5;
export const MIN_RENDER_SCALE = 0.5;

/** Camera: a slight handheld drift perpendicular to the diagonal. */
export const CAM_A = 26; // px, 1 cycle per 540
export const CAM_B = 14; // px, 2 cycles per 540
export const CAM_PHASE = 1.1;

export const COLORS = {
  bg: '#05090C',
  codeCyan: '#4FD4D9',
  codeWhite: '#E8F4F5',
  iconTeal: '#2E9CA8',
  dimTeal: '#14454A',
  accentOrange: '#E8862E',
  accentYellow: '#E8C84F',
  accentGreen: '#4FE07F',
} as const;

export const ACCENTS = [
  COLORS.accentOrange,
  COLORS.accentYellow,
  COLORS.accentGreen,
] as const;

/**
 * Population sizes.
 *
 * These are totals, sized so that the *in-frame* counts land on the numbers the
 * shot is specified around: ~60 snippets, ~25 icons, ~20 binary runs, ~40
 * streaks and ~15 accent squares. About 80% of the field is on screen at any
 * moment - the rest is mid-wrap, just off the edge.
 */
export const COUNT_CODE = 68;
export const COUNT_ICON = 29;
export const COUNT_BINARY = 23;
export const COUNT_STREAK = 48;
export const COUNT_ACCENT = 20;

/** Post. */
export const VIGNETTE = 0.22;
export const GRAIN_ALPHA = 0.045;
export const GRAIN_TILES = 12;
export const GRAIN_TILE_PX = 320;
