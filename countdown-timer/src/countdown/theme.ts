/**
 * Palette and construction values — shared by all three variants.
 *
 * Every length is expressed as a fraction of the FRAME HEIGHT (or of the
 * derived ring radius), never in raw pixels, so the same numbers describe
 * the piece at 4K, at 1080p, and at any preview scale.
 */

export const PALETTE = {
  background: "#000000",
  barCyan: "#2EE8E0", // the sweep's start
  barBlue: "#3F6FF5", // its middle
  barViolet: "#7B4FE8",
  barMagenta: "#E85FD4", // its end
  ringTrack: "#1A1A2E", // faint circle behind the bars
  digitWhite: "#FFFFFF", // lit segments
  digitDim: "#1E1E28", // unlit segments — faintly visible
  labelPale: "#8A8A9A", // MINS / SECS
} as const;

/** Frames spent resting on 00:00 after the count reaches zero. */
export const HOLD_FRAMES = 30;

/** Number of frames the digits stay flashed after a second boundary. */
export const FLASH_FRAMES = 2;

/** The countdown builds tension over its final this-many seconds. */
export const FINAL_BUILD_SECONDS = 10;

export const RING = {
  /** Track diameter as a fraction of frame height. */
  trackDiameterFrac: 0.28,
  /** How much further the LONGEST bar reaches, as a fraction of frame height. */
  barReachFrac: 0.1,
  /** Longest : shortest bar. */
  barLengthRatio: 3,
  /** Evenly spaced — the bars read as a meter because their LENGTHS differ. */
  barCount: 76,
  /** Bar stroke width as a fraction of frame height (~9px at 2160). */
  barWidthFrac: 0.0042,
  /** Track stroke width as a fraction of frame height (~6px at 2160). */
  trackWidthFrac: 0.0028,
} as const;

/**
 * Digit-block metrics, all as multiples of the track RADIUS, so the
 * MM:SS block and its labels always sit comfortably inside the ring.
 */
export const DIGITS = {
  heightR: 0.53,
  widthR: 0.31,
  thicknessR: 0.066,
  /** Gap between two segment ends, as a multiple of segment thickness. */
  segmentGapT: 0.2,
  colonWidthR: 0.132,
  /** Between the two digits of a pair. */
  digitGapR: 0.05,
  /** Between a pair and the colon. */
  pairGapR: 0.113,
  /** Vertical offset of the digit block's centre from frame centre. */
  centerOffsetR: -0.06,
  labelSizeR: 0.113,
  /** Baseline of MINS / SECS, below frame centre. */
  labelBaselineR: 0.36,
  labelTrackingR: 0.024,
} as const;

/** Ambient drift of the whole assembly: +/- this many pixels, closed path. */
export const DRIFT_PX = 6;

export type Layout = {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  trackRadius: number;
  barWidth: number;
  trackWidth: number;
  barMinLength: number;
  barMaxLength: number;
};

export const computeLayout = (width: number, height: number): Layout => {
  const trackRadius = (height * RING.trackDiameterFrac) / 2;
  const barMaxLength = height * RING.barReachFrac;
  return {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    trackRadius,
    barWidth: height * RING.barWidthFrac,
    trackWidth: height * RING.trackWidthFrac,
    barMaxLength,
    barMinLength: barMaxLength / RING.barLengthRatio,
  };
};
