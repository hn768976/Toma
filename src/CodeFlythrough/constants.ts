/**
 * Values shared by every cut of the shot.
 *
 * Anything that differs between cuts - palette, tilt, length, and the geometry
 * that falls out of tilt - lives in `variant.ts` instead.
 */

export const FPS = 60;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const CX = WIDTH / 2;
export const CY = HEIGHT / 2;

/**
 * Per-element rotation jitter, in degrees.
 *
 * Zero: every element sits on exactly the tilt its cut specifies. Any spread at
 * all reads as inconsistency once the field is this dense, so the stream is
 * kept rigid.
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

/** speed = z * BASE_SPEED, in px per frame. Independent of a cut's length. */
export const BASE_SPEED = 48;

/** Native (unscaled) type size for code and binary. */
export const FONT_PX = 36;
export const LINE_HEIGHT = 1.42;

/** Sprites are rasterised at most this large, then upscaled at draw time. */
export const MAX_RENDER_SCALE = 1.5;
export const MIN_RENDER_SCALE = 0.5;

/** Camera: a slight handheld drift perpendicular to the stream's axis. */
export const CAM_A = 26; // px, 1 cycle per loop
export const CAM_B = 14; // px, 2 cycles per loop
export const CAM_PHASE = 1.1;

/** How much wider than the visible frame the field is scattered. */
export const PERP_MARGIN = 780;

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
 * Two large, sharp code blocks on the shared tilt. A hero comes in quickly,
 * eases to a dead stop in the middle of frame, finishes writing its last two
 * lines while stationary, sits a beat, then accelerates away. They are drawn
 * live rather than from a cached sprite, since their content changes frame to
 * frame.
 */
export const COUNT_HERO = 2;
/** Sits at the far edge of the sharp band, so its blur is zero. */
export const HERO_Z = 0.49;
/** Fixed rather than derived from z: the hero is deliberately oversized. */
export const HERO_SCALE = 2.45;
/**
 * A hero crosses once per loop, so it drifts through the whole cut. Travel is
 * set from the distance it needs to clear frame rather than from its depth,
 * which is what lets it move slowly enough to read.
 */
export const HERO_TRAVEL_MULT = 2.15;
/**
 * How long a hero holds still, in seconds.
 *
 * In seconds rather than as a fraction of the crossing, so the pause reads the
 * same length whatever a cut's duration is - as a fraction it would stretch
 * with the cut and a longer edit would sit on the hero far too long. Each
 * variant converts it into its own fraction.
 *
 * The distance a hero covers is unchanged, so the time it does not spend
 * stopped is spent moving faster - and the fastest point is the wrap, where it
 * is off frame anyway. Slow where it is readable, quick where it is not.
 */
export const HERO_DWELL_SECONDS = 1.3;

/** The half-width of the stop as a fraction of the crossing. */
export const heroDwellFor = (durationInFrames: number) =>
  Math.min(0.45, (HERO_DWELL_SECONDS * FPS) / (2 * durationInFrames));
/**
 * Typing runs over this window of the crossing and then holds complete.
 *
 * The window is measured against the crossing's own clock, not against the
 * hero's position, so the writing carries on at a steady rate through the stop
 * instead of freezing with it. It is timed to finish just as the hero settles.
 *
 * Both are tied to the crossing rather than to a wall clock, so they loop for
 * free: at the last frame every element is back at its frame-0 crossing
 * position and therefore at its frame-0 typing state.
 */
export const HERO_TYPE_START = 0.28;
export const HERO_TYPE_SPAN = 0.18;
/**
 * Caret blinks per loop.
 *
 * Expressed as a whole number of blinks rather than a period in frames, so it
 * closes on the loop whatever length a cut is. Roughly a 36-frame period.
 */
export const caretBlinksFor = (durationInFrames: number) =>
  Math.max(1, Math.round(durationInFrames / 36));
