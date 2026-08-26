/**
 * Top-level configuration, keyed by variant.
 *
 * ── A note on the loop arithmetic ─────────────────────────────────────────
 * The composition is a seamless 744-frame loop, which forces one hard
 * relationship: the series must tile, so exactly one series-width of scroll
 * has to pass in 744 frames. That pins
 *
 *      framesPerCandle = 744 / SERIES_LEN
 *
 * so the series length, the scroll speed and the loop length are a single
 * choice, not three. `SERIES_LEN = 150` gives 4.96 frames per candle and a
 * scroll of 10.48 px/frame at 4K — which measures within 1% of the reference
 * clip's own scroll rate (~312 px/s, recovered by cross-correlating strips of
 * consecutive frames). 150 candles is also long enough to carry the whole
 * requested narrative — runs, a capitulation, two failed rallies — inside a
 * single loop, where a much longer series simply could not be seen.
 * ──────────────────────────────────────────────────────────────────────────
 */

export type Variant = 'bear' | 'bull';

export const FPS = 30;
export const DURATION = 744;
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Candles per tile. One tile-width of scroll happens per loop. */
export const SERIES_LEN = 150;

/** Chart-space geometry (origin at chart centre, y grows downward). */
export const CHART = {
  /** chart-space extent, generous enough to survive the camera tilt */
  width: 4600,
  height: 2900,
  /** horizontal pitch between candle centres, px */
  pitch: 52,
  /** candle body / wick widths at 4K */
  bodyWidth: 14,
  wickWidth: 3,
  /** vertical band the price series is mapped into */
  priceTop: -900,
  priceBottom: 280,
  /** volume bars grow upward from this baseline */
  volumeBaseline: 950,
  volumeMaxHeight: 520,
  volumeBarWidth: 11,
  /** order-book column, right edge of the chart */
  ladderX: 1400,
  ladderCellWidth: 160,
  ladderCellHeight: 30,
  ladderCells: 26,
  ladderTop: -780,
  ladderBottom: 1180,
  /**
   * Chart-space x at which a new candle is born. It sits inside the frame but
   * well into the defocused right-hand zone, so the forming candle reads as a
   * soft flicker rather than a hard shape change.
   */
  formingEdgeX: 1368,
  /** How many candle-widths a candle spends "forming" before it locks. */
  formingSpanCandles: 2.5,
} as const;

/** Depth-of-field field, defined in final screen space (px). */
export const DOF = {
  /** focal band centre, as a fraction of the frame */
  focusX: 0.3,
  focusY: 0.52,
  /** normalised falloff radii — the right side goes soft fastest */
  radiusRight: 0.3,
  radiusLeft: 0.44,
  radiusVertical: 0.34,
  /** distance below which everything is fully sharp */
  deadZone: 0.34,
  /** distance at which blur reaches maximum */
  maxDistance: 1.5,
  /** blur applied to each of the three buffers, in final-frame px */
  blurSharp: 0,
  blurMid: 11,
  blurFar: 30,
  /** downscale factor of each buffer's backing store (far is blurred to mush) */
  scaleSharp: 1,
  scaleMid: 0.5,
  scaleFar: 0.34,
  /** buffer bleed margin so blurs do not suck in transparent black at edges */
  margin: 90,
} as const;

/** Slow global brightness breathe. 248 divides 744 exactly (3 cycles). */
export const BREATHE = {period: 248, amount: 0.03} as const;

export const FINISH = {
  vignette: 0.22,
  grainAlpha: 0.04,
  grainTile: 512,
  bloomScale: 0.09,
  bloomStrength: 0.5,
} as const;

export type VariantConfig = {
  /** net directional pressure of the walk, -1 falling, +1 rising */
  trendBias: -1 | 1;
  /** min/max length of a trending run, in candles */
  runLength: [number, number];
  /** probability a candle grows a prominent wick */
  wickFrequency: number;
  /** wick length multiplier */
  wickLength: number;
  /** bar-to-bar noise, in price units */
  volatility: number;
  /** multiplier on drawn body height (via the open gap) */
  bodySize: number;
  /**
   * Opening-gap bias. Real candles open away from the previous close; a small
   * seeded gap lets the *drawn* bodies favour one colour without touching the
   * closing path, which has to stay net-zero for the tile to close.
   */
  gapBias: number;
  /** camera tilt, degrees */
  tiltDeg: number;
  /** camera shear (right-side compression), degrees */
  shearDeg: number;
  /** camera zoom, enough to keep the tilted content past the frame corners */
  cameraScale: number;
  /** order-book flashes per second */
  ladderFlashRate: number;
  /** fraction of candles drawn hollow */
  hollowRate: number;
  /**
   * Trend line, in chart space: y at the left chart edge and at the right,
   * low contrast, static (a straight line translated along itself by the
   * scroll is the same line, which is what lets it tile).
   */
  trendLine: {leftY: number; rightY: number};
  seed: string;
};

export const VARIANTS: Record<Variant, VariantConfig> = {
  bear: {
    trendBias: -1,
    runLength: [18, 40],
    wickFrequency: 0.88,
    wickLength: 1,
    volatility: 1.05,
    bodySize: 1,
    gapBias: 0.24,
    tiltDeg: -9,
    shearDeg: 7,
    cameraScale: 1.16,
    ladderFlashRate: 3,
    hollowRate: 0.22,
    // above the price band for most of the frame
    trendLine: {leftY: -640, rightY: -300},
    seed: 'candle-macro-bear-v1',
  },
  bull: {
    trendBias: 1,
    // longer, steadier trends
    runLength: [35, 75],
    // ~40% fewer spikes
    wickFrequency: 0.88 * 0.6,
    wickLength: 1.2,
    // ~35% calmer bar-to-bar
    volatility: 1.05 * 0.65,
    // ~20% more decisive bodies
    bodySize: 1.2,
    gapBias: 0.4,
    // shallower tilt: a steep rise over a rising series tips into melodrama
    tiltDeg: -6,
    shearDeg: 7,
    cameraScale: 1.13,
    // the calmer market feels calmer in every element
    ladderFlashRate: 2,
    hollowRate: 0.22,
    // below the price band for most of the frame
    trendLine: {leftY: 130, rightY: -130},
    seed: 'candle-macro-bull-v1',
  },
};
