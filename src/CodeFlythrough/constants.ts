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

/**
 * Per-element rotation jitter, in degrees.
 *
 * Zero: every element sits on exactly the same tilt. Any spread at all reads
 * as inconsistency once the field is this dense, so the stream is kept rigid.
 */
export const ROT_JITTER_DEG = 0;

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

/**
 * HERO FRAGMENTS
 *
 * Two large, sharp code blocks on the shared tilt whose second half types
 * itself out as they cross, so the field reads as code being written rather
 * than only code drifting past. They are drawn live rather than from a cached
 * sprite, since their content changes frame to frame.
 */
export const COUNT_HERO = 2;
/** Sits at the far edge of the sharp band, so its blur is zero. */
export const HERO_Z = 0.49;
/** Fixed rather than derived from z: the hero is deliberately oversized. */
export const HERO_SCALE = 2.45;
/**
 * A hero crosses once per loop, so it drifts through the whole nine seconds.
 * Travel is set from the distance it needs to clear frame rather than from its
 * depth, which is what lets it move slowly enough to read.
 */
export const HERO_TRAVEL_MULT = 2.15;

/**
 * The hold.
 *
 * A hero does not drift at a constant rate. It comes in quickly, eases to a
 * dead stop as it reaches the middle of frame, sits there while it finishes
 * writing itself, then accelerates away. HERO_DWELL is the half-width of the
 * stop as a fraction of the crossing: 0.07 means it is stationary for 14% of
 * its nine seconds, a shade over a second.
 *
 * The distance is unchanged, so the time it does not spend stopped is spent
 * moving faster - and the fastest point is the wrap, where it is off frame
 * anyway. Slow where it is readable, quick where it is not.
 */
export const HERO_DWELL = 0.07;

/**
 * Typing runs over this window of the crossing and then holds complete.
 *
 * The window is measured against the crossing's own clock, not against the
 * hero's position, so the writing carries on at a steady rate through the stop
 * instead of freezing with it. It is timed to finish just after the hero
 * settles, leaving about a second of written, motionless text.
 *
 * Both are tied to the crossing rather than to a wall clock, so they loop for
 * free: at frame 540 every element is back at its frame-0 crossing position and
 * therefore at its frame-0 typing state.
 */
export const HERO_TYPE_START = 0.28;
export const HERO_TYPE_SPAN = 0.18;
/** Caret blink period in frames. Must divide DURATION: 540 / 36 = 15. */
export const HERO_CARET_PERIOD = 36;
