/**
 * Master composition settings.
 *
 * The compositions are DEFINED at 4K so they can be rendered at 3840x2160
 * later; the preview in this repo is produced with `--scale=0.5`.
 * Every size in the project is expressed as a fraction of these dimensions
 * (or in world units), so output resolution never changes the framing.
 */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 600; // 20s

/** Frame the packaged still is exported from. */
export const STILL_FRAME = 400;

/** Motion beats, in frames. */
export const BEATS = {
  /** The brain contour draws on over this range. */
  drawOnStart: 0,
  drawOnEnd: 90,
  /** "AI" fades up inside the contour. */
  aiStart: 80,
  aiEnd: 120,
  /** The contact point ignites and fans rays. */
  igniteStart: 92,
  igniteEnd: 132,
} as const;
