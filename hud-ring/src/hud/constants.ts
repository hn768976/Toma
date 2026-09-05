/**
 * Master composition constants.
 *
 * The composition is authored at 3840x2160 so it can be rendered at true 4K.
 * Every size in the scene is derived from the frame height at runtime
 * (see `useVideoConfig()` in the components), so the same source renders
 * correctly at any resolution or aspect ratio.
 */
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const DURATION_IN_FRAMES = 300;

/** Frame exported as the poster still for each version. */
export const STILL_FRAME = 280;

/**
 * Build sequence. Each entry is [firstFrame, lastFrame] of the beat during
 * which every element of that layer has finished arriving.
 */
export const BEATS = {
  dashedCircle: [0, 20],
  segmentRing: [20, 70],
  blockRing: [60, 130],
  arcs: [100, 170],
  ticks: [140, 205],
  dataBlocks: [145, 210],
  outer: [190, 250],
  hold: [250, 300],
} as const;

/** Per-element draw/pop duration inside each beat, in frames. */
export const ITEM_DURATION = {
  dash: 6,
  segment: 10,
  block: 9,
  arc: 26,
  tick: 8,
  dataBlock: 13,
  outerArc: 30,
  radial: 22,
  cornerMark: 12,
} as const;

/**
 * Rotation rates in degrees per frame. Different rates and directions per
 * ring; each ring starts turning as soon as its beat begins.
 */
export const SPIN = {
  dashedCircle: 0.1,
  segmentRing: -0.062,
  blockRing: 0.034,
  arcsInner: -0.09,
  arcsMid: 0.052,
  arcsOuter: -0.028,
  ticks: 0.022,
  dataBlocks: -0.044,
  outer: 0.016,
} as const;
