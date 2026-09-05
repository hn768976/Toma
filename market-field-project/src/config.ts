/**
 * Every tunable for the Market Chart Field animation.
 *
 * Sizes are stored as fractions of the frame so a 1080p preview
 * (`--scale=0.5`) is pixel-for-pixel the same composition as the 4K master.
 */

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const DURATION_IN_FRAMES = 600; // 20s

/**
 * Loop contract
 * -------------
 * Series values are a pure function of `index mod CYCLE_LENGTH`, and over
 * DURATION_IN_FRAMES the window scrolls by exactly SCROLL_POINTS_PER_LOOP
 * points. Because SCROLL_POINTS_PER_LOOP is a whole multiple of
 * CYCLE_LENGTH, frame 600 samples exactly the data frame 0 did: the loop is
 * seamless with no cross-fade and no drift.
 */
export const CYCLE_LENGTH = 300;
export const SCROLL_POINTS_PER_LOOP = 300;
export const POINTS_ACROSS = 260; // data points spanning the frame width
export const SCROLL_POINTS_PER_FRAME =
  SCROLL_POINTS_PER_LOOP / DURATION_IN_FRAMES; // 0.5

/** Chart geometry, as fractions of frame width/height. */
export const CHART = {
  /** Noise amplitude around the envelope. */
  amplitude: 0.105,
  /** Stroke width and its two glow passes. */
  strokeWidth: 0.0016,
  innerGlowWidth: 0.0045,
  outerGlowWidth: 0.013,
  innerGlowBlur: 0.0018,
  outerGlowBlur: 0.0052,
  /** The fill sits well behind the stroke and is softened, never crisp. */
  fillBlur: 0.004,
  fillTopOpacity: 0.36,
  fillMidOpacity: 0.12,
  /** How far below the frame the filled area is closed off. */
  baselineOverdraw: 0.18,
} as const;

/**
 * Envelope control points (top-fraction of the frame height) sampled at
 * x = 0, 0.25, 0.5, 0.75, 1. These are a function of SCREEN position, not of
 * data index, so the compositional shape stays put while the jagged data
 * scrolls through it — which is what lets a "rising" series loop at all.
 */
export const RISING_ENVELOPE = [0.8, 0.73, 0.6, 0.45, 0.32] as const;
export const FALLING_ENVELOPE = [0.28, 0.41, 0.57, 0.71, 0.82] as const;

/** Floating bokeh candlesticks. */
export const BARS = {
  count: 68,
  /** Vertical travel range as a fraction of height (bars wrap over this). */
  travelRange: 1.34,
  bodyWidthNear: 0.0042,
  bodyWidthFar: 0.0068,
  bodyHeightNear: 0.019,
  bodyHeightFar: 0.03,
  wickExtra: 1.75, // wick length as a multiple of body height
  wickWidth: 0.34, // fraction of body width
  maxBlur: 0.013, // fraction of width, at maximum depth
  swayMax: 0.045, // lateral sway amplitude, fraction of width
  blurLevels: 9, // blur is quantised, which keeps the offscreen sizes stable
} as const;

/** Additive dither. Breaks H.264 banding in the dark gradients. */
export const GRAIN = {
  tileSize: 1024,
  /** 600 % variants === 0, so the grain cycle loops with the video. */
  variants: 12,
  maxAlpha: 0.05,
} as const;

export const SEED = 0x5eed_1a7e;
