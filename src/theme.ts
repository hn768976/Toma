/**
 * Single source of truth for colour and per-variant behaviour.
 * Every hex literal in the project lives in this file.
 */

export type Variant = 'bear' | 'bull';

/** The palette is shared by both variants — the bull reads greener purely
 *  because more of its candles are green, not because the hues changed. */
const PALETTE = {
  backgroundDeep: '#050A12',
  backgroundMid: '#0C1A26',
  gridLine: '#14283A',
  dashedLine: '#4A6478',
  candleGreen: '#2FD9A0',
  candleRed: '#E8455F',
  ladderWhite: '#E8F0F5',
  textDim: '#8AA0B0',
  bloomCore: '#FFFFFF',
  vignette: '#000000',
  grainNeutral: '#808080',
} as const;

export type Theme = typeof PALETTE;

export const THEMES: Record<Variant, Theme> = {
  bear: {...PALETTE},
  bull: {...PALETTE},
};

/* ------------------------------------------------------------------ */
/* Composition geometry                                                */
/* ------------------------------------------------------------------ */

export const COMP = {
  width: 3840,
  height: 2160,
  fps: 30,
  durationInFrames: 744,
} as const;

/**
 * 744 frames / 186 candles = exactly 4 frames per candle, and the scroll
 * covers exactly one series width per loop, so frame 744 === frame 0.
 * See README for why the series is 186 candles rather than 600.
 */
export const CANDLE_COUNT = 186;
export const SPACING = 52;
export const SERIES_WIDTH = CANDLE_COUNT * SPACING;
export const FRAMES_PER_CANDLE = COMP.durationInFrames / CANDLE_COUNT;

export const BODY_W = 14;
export const WICK_W = 3;

/** Composition-space chart geometry (before the camera transform). */
export const CHART_MID_Y = 790;
export const PRICE_BAND_PX = 640;
export const CHART_RIGHT_X = 3290;
export const CHART_LEFT_X = -900;

/** Volume bars live in the bottom third. */
export const VOL_BASE_Y = 1985;
export const VOL_MAX_H = 375;
export const VOL_BAR_W = 11;

/** Order-book ladder, right edge, deep in the defocused zone. */
export const LADDER = {
  x: 3610,
  top: 300,
  bottom: 1900,
  cells: 26,
  cellW: 96,
  cellH: 30,
} as const;

/* ------------------------------------------------------------------ */
/* Depth of field                                                      */
/* ------------------------------------------------------------------ */

/** Three buckets: sharp, mid, far. Elements crossfade between adjacent
 *  buckets so the falloff reads as continuous. */
export const BLUR_RADII = [0, 8, 28] as const;
export const MAX_BLUR = BLUR_RADII[2];

/** Focal band, in screen-space fractions of the frame. */
export const FOCUS = {
  cx: 0.30,
  cy: 0.50,
  fallRight: 0.42,
  fallLeft: 0.88,
  fallVertical: 0.36,
  inner: 0.30,
  outer: 1.32,
} as const;

/* ------------------------------------------------------------------ */
/* Finish                                                              */
/* ------------------------------------------------------------------ */

export const FINISH = {
  breatheAmount: 0.03,
  breathePeriod: 248, // divides 744 exactly
  vignetteStrength: 0.22,
  grainAlpha: 0.04,
  grainTile: 1024,
  bloomScale: 0.25,
  bloomBlur: 7,
  bloomGain: 0.85,
} as const;

/* ------------------------------------------------------------------ */
/* Per-variant configuration                                           */
/* ------------------------------------------------------------------ */

export type EventKind =
  | 'rallyUp'
  | 'rollOver'
  | 'capitulation'
  | 'consolidation'
  | 'sharpDrop'
  | 'recover';

export type EventSpec = {
  kind: EventKind;
  /** Start position as a fraction of the series. */
  at: number;
  len: number;
  /** rallyUp: how far back to measure the drop it is retracing. */
  lookback?: number;
  /** rallyUp: fraction of that drop to recover. */
  retrace?: number;
};

export type VariantConfig = {
  /** Trend bias, in screen px per candle. Negative falls to the right. */
  trendBias: number;
  /** Run length range, in candles. */
  runLength: [number, number];
  /** Counter-trend runs are scaled by this. */
  counterRunScale: number;
  counterStrength: number;
  /** Probability that a fresh run goes with the trend. */
  withTrendProbability: number;
  /** Bar-to-bar random variance. */
  volatility: number;
  /** Directional step size — "body size". */
  driftScale: number;
  /** Share of candles that get a long wick. */
  wickFrequency: number;
  wickScale: number;
  /** Pull back toward the trend line; keeps the series inside the band. */
  meanReversion: number;
  /** How many series widths scroll past per loop. Must be an integer. */
  scrollTilesPerLoop: number;
  /** Camera tilt, degrees. */
  tiltDeg: number;
  shearDeg: number;
  cameraScale: number;
  /** Ladder flashes per second, [min, max]. */
  flashRate: [number, number];
  /** Where the trend line sits: 0.85 = above 85% of closes. */
  trendQuantile: number;
  hollowShare: number;
  events: EventSpec[];
};

export const VARIANTS: Record<Variant, VariantConfig> = {
  /* v1 — volatile decline. Short choppy runs, frequent reversals, long wicks. */
  bear: {
    trendBias: -6.0,
    runLength: [18, 40],
    counterRunScale: 0.72,
    counterStrength: 0.82,
    withTrendProbability: 0.6,
    volatility: 1.0,
    driftScale: 1.0,
    wickFrequency: 0.8,
    wickScale: 1.0,
    meanReversion: 0.02,
    scrollTilesPerLoop: 1,
    tiltDeg: -9,
    shearDeg: 7,
    cameraScale: 1.06,
    flashRate: [2, 4],
    trendQuantile: 0.86,
    hollowShare: 0.24,
    events: [
      {kind: 'rallyUp', at: 0.18, len: 15, lookback: 26, retrace: 0.4},
      {kind: 'rollOver', at: 0.18, len: 11},
      {kind: 'capitulation', at: 0.5, len: 15},
      {kind: 'rallyUp', at: 0.7, len: 16, lookback: 28, retrace: 0.4},
      {kind: 'rollOver', at: 0.7, len: 12},
    ],
  },

  /* v2 — orderly advance. Longer, steadier runs; calmer bars; cleaner bodies. */
  bull: {
    trendBias: 4.9,
    runLength: [35, 75],
    counterRunScale: 0.26,
    counterStrength: 0.9,
    withTrendProbability: 0.72,
    volatility: 0.65, // -35%
    driftScale: 1.2, // +20%
    wickFrequency: 0.48, // -40%
    wickScale: 0.85,
    meanReversion: 0.02,
    scrollTilesPerLoop: 1,
    tiltDeg: -6,
    shearDeg: 7,
    cameraScale: 1.06,
    flashRate: [1, 3],
    trendQuantile: 0.14,
    hollowShare: 0.24,
    events: [
      {kind: 'sharpDrop', at: 0.2, len: 6},
      {kind: 'recover', at: 0.2, len: 8},
      {kind: 'consolidation', at: 0.44, len: 30},
      {kind: 'sharpDrop', at: 0.76, len: 6},
      {kind: 'recover', at: 0.76, len: 8},
    ],
  },
};
