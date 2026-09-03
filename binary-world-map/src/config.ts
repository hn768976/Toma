/**
 * Top-level knobs. Everything the brief calls out as tunable — digit size,
 * node count, push-in amount, contour density — is here rather than buried in
 * a component.
 */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 450;

export const CONFIG = {
  /** Map framing. `scale` is pixels per radian of the plate carree. */
  map: {
    centerLon: 10,
    centerLat: 14.5,
    scale: 640,
    /** Polygons entirely south of this are dropped (i.e. Antarctica). */
    southLimit: -55,
  },

  /** The binary land fill. */
  digits: {
    fontSize: 14,
    /** Horizontal advance of one digit cell, in 4K pixels. */
    cellWidth: 8,
    /** Row pitch. Regular, unlike the horizontal jitter. */
    rowHeight: 13,
    /** Max horizontal offset per digit so rows do not read as a printed grid. */
    jitter: 1.6,
    /** Digits that change value each second. */
    rerollsPerSecond: 55,
    /** Frames a rerolled digit stays flashed. */
    flashFrames: 3,
  },

  /** Soft light behind the continents. */
  glow: {
    blur: 48,
    alpha: 0.4,
    /** Fractional breathing amplitude. */
    breath: 0.08,
    periodInFrames: 196,
  },

  connections: {
    count: 18,
    /** Stroke width at 4K. */
    lineWidth: 2,
    opacity: 0.24,
    /** How far past the frame the lines run, in pixels. */
    overshoot: 2600,
    /** Length of a travelling highlight, in pixels. */
    highlightLength: 640,
    /** Frames a highlight takes to cross its line. */
    highlightDuration: 46,
    /** Cycle length per line; longer = fewer highlights on screen at once. */
    highlightCycle: 500,
  },

  nodes: {
    count: 24,
    /** Fraction of nodes drawn noticeably larger and brighter. */
    majorFraction: 0.22,
    radiusMinor: 5,
    radiusMajor: 12,
    haloScale: 5.5,
    flashFrames: 4,
    /** Per-node cycle length; drives the ~2-3 flashes per second overall. */
    flashCycle: 290,
  },

  contours: {
    count: 14,
    /** Control points per curve. */
    points: 9,
    lineWidth: 2,
    opacity: 0.3,
    /** Drift is deliberately slower than the push-in so the layers separate. */
    driftAmplitude: 26,
    driftPeriod: 340,
  },

  callouts: {
    count: 10,
    fontSize: 13,
    lineHeight: 18,
    /** Callouts that carry a large two-digit number. */
    bigNumberCount: 2,
    bigNumberSize: 84,
    /** Frames between text rerolls. */
    rerollPeriod: 74,
  },

  stars: {
    count: 460,
    radiusMin: 1.1,
    radiusMax: 2.9,
    opacity: 0.55,
  },

  /** The push-in: the only large-scale motion. */
  pushIn: {
    from: 1,
    to: 1.14,
    /** Anchor, as a fraction of the frame. Off-centre so framing shifts too. */
    originX: 0.44,
    originY: 0.415,
  },

  finish: {
    bloomDownscale: 4,
    bloomBlur: 2,
    bloomSpread: 6,
    bloomOpacity: 0.5,
    nodeBloomBlur: 16,
    nodeBloomOpacity: 0.55,
    vignette: 0.24,
    grainAlpha: 0.04,
    grainTile: 128,
    grainVariants: 8,
    grainScale: 2,
  },
} as const;
