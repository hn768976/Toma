/**
 * Frame, timing and hub geometry shared by all three node-hub variants.
 *
 * LOOP CONTRACT: the composition is exactly LOOP_FRAMES long and frame 0 must
 * be pixel-identical to frame LOOP_FRAMES. Everything periodic therefore
 * either advances by whole turns across the loop (rotations) or has a period
 * that divides LOOP_FRAMES exactly (pulses, rerolls, travelling dots). The
 * PERIODS below are the only periods used; `assertDividesLoop` guards them.
 */

export const FPS = 30;

/** 450 frames @ 30fps = 15.0s. */
export const LOOP_FRAMES = 450;

export const FRAME_W = 3840;
export const FRAME_H = 2160;

export const CENTRE_X = FRAME_W / 2;
export const CENTRE_Y = FRAME_H / 2;

/**
 * Hub assembly radii, in 4K pixels. The broken-arc ring is the nominal hub
 * radius: ~24% of frame height across, per the design spec.
 */
export const HUB_RADIUS = Math.round((FRAME_H * 0.24) / 2); // 259
export const HUB_INNER_CIRCLE = Math.round(HUB_RADIUS * 0.79);
export const HUB_SECONDARY_ARC = Math.round(HUB_RADIUS * 0.885);
export const HUB_TICK_INNER = HUB_RADIUS + 22;
export const HUB_TICK_OUTER = HUB_RADIUS + 46;
export const HUB_TICK_COUNT = 120;

/** Whole turns completed across one loop. Integers keep the loop seamless. */
export const HUB_ARC_TURNS = -1; // broken arc segments, counter-clockwise
export const HUB_SECONDARY_TURNS = -2; // decorative inner broken ring
/**
 * The tick ring counter-rotates against the arcs. 120 equally spaced ticks
 * have a symmetry period of 360/120 degrees, so advancing a whole number of
 * tick steps (30 of them = 90 degrees) closes the loop without needing a
 * full turn.
 */
export const HUB_TICK_STEPS = 30;

/** Periods in frames. Each divides LOOP_FRAMES exactly. */
export const PERIODS = {
  /** Panel value rerolls: 90 buckets/loop = 6 per second. */
  panelFast: 5,
  /** Panel value rerolls: 75 buckets/loop = 5 per second. */
  panelSlow: 6,
  /** Large numeric readouts: within the 40-70 frame window from the spec. */
  readoutA: 45,
  readoutB: 50,
  /** Travelling-dot transit times. */
  dot: [50, 75, 90, 150, 225] as const,
  /** Bokeh drift cycles. */
  bokeh: [150, 225, 450] as const,
  /** Connector shimmer. */
  shimmer: 90,
  /** One progress-dial fill; three cycles per loop. */
  dial: 150,
} as const;

/** Throws if `period` would break loop closure. Called from module scope. */
export const assertDividesLoop = (label: string, period: number): number => {
  if (!Number.isInteger(period) || period <= 0 || LOOP_FRAMES % period !== 0) {
    throw new Error(
      `node-hub: ${label} period ${period} does not divide ${LOOP_FRAMES}; the loop would not close`,
    );
  }
  return period;
};

for (const [key, value] of Object.entries(PERIODS)) {
  const list = Array.isArray(value) ? value : [value];
  for (const period of list) assertDividesLoop(key, period as number);
}

/** Progress through the loop, 0 at frame 0 and 1 at frame LOOP_FRAMES. */
export const loopT = (frame: number): number =>
  (frame % LOOP_FRAMES) / LOOP_FRAMES;

/** Which reroll bucket `frame` falls in, restarting every loop. */
export const bucket = (frame: number, period: number): number =>
  Math.floor((frame % LOOP_FRAMES) / period);
