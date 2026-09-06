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
export const CYCLE_LENGTH = 480;
export const SCROLL_POINTS_PER_LOOP = 480;
export const POINTS_ACROSS = 240; // data points spanning the frame width
export const SCROLL_POINTS_PER_FRAME =
  SCROLL_POINTS_PER_LOOP / DURATION_IN_FRAMES; // 0.5

/**
 * Camera. See src/camera.ts for how the lattice and the fade window fit
 * together; the short version is that the camera advances exactly one
 * `cellDepth` over DURATION_IN_FRAMES, so the plane lattice maps onto itself
 * at the loop point.
 */
export const CAMERA = {
  /** How many lattice planes to consider; only ~2 are ever visible. */
  cells: 3,
  /** Depth of the nearest plane (v = 0), in cell units. Smaller = a harder,
   *  more accelerating push as a plane sweeps past the lens. */
  nearDepth: 0.55,
  /** The depth at which a plane is drawn at its authored size. */
  refV: 1,
  /** Depth at which a plane is at full opacity; it fades out toward the
   *  camera and in from the back. */
  windowCenter: 1,
  /** The point the camera flies toward, as a fraction of the frame. */
  vanishX: 0.5,
  vanishY: 0.46,
  /** Extra depth for the map lattice, in cell units. This is the parallax:
   *  the map is further back, so it grows more slowly than the charts. */
  mapDepth: 0.85,
  /** Depth of field. Focus sits at the plane holding full opacity, and only
   *  the near side defocuses: a plane coming at the lens blows out into a
   *  soft mass while the one behind it stays sharp. Without this the two
   *  visible planes read as a double exposure rather than as depth. */
  focusDepth: 1,
  dofFalloff: 0.9,
  dofMaxBlur: 0.016, // fraction of frame width, on screen
  /** Steep, so the plane holding focus stays crisp and only a plane well
   *  inside the focal distance goes soft. */
  dofNearExponent: 2.2,
  /** A much gentler far-side defocus. Without it the plane fading in behind
   *  is sharp at 15% opacity, which reads as a ghost rather than as distance. */
  dofFarBlur: 0.0035,
  dofFarFalloff: 1,
  dofFarExponent: 1.6,
  mapDofScale: 0.45, // the map defocuses less; it is barely there to begin with
} as const;

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
  /**
   * How far past the frame the chart is drawn, as a fraction of the frame.
   * A plane sitting behind the focus is smaller than the frame, so the chart
   * has to keep going well past the edges or its geometry runs out and
   * leaves a hard rectangle. Sized for the smallest scale the fade window
   * ever shows — see CAMERA and src/camera.ts.
   */
  overscan: 0.38,
  /** How far below the frame the filled area is closed off. */
  baselineOverdraw: 0.45,
} as const;

/**
 * Envelope control points (top-fraction of the frame height), equally spaced
 * across the overscanned span from -overscan to 1 + overscan. These are a
 * function of SCREEN position, not of data index, so the compositional shape
 * stays put while the jagged data scrolls through it — which is what lets a
 * "rising" series loop at all. The outer points continue each trend past the
 * frame edges, so a plane behind the focus shows more of the same chart
 * rather than the end of it.
 */
export const RISING_ENVELOPE = [
  0.93, 0.86, 0.789, 0.725, 0.6, 0.456, 0.341, 0.24, 0.15,
] as const;
export const FALLING_ENVELOPE = [
  0.14, 0.21, 0.3, 0.416, 0.57, 0.704, 0.802, 0.885, 0.95,
] as const;

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
