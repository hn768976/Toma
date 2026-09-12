// Deterministic generators for everything on the plane besides the baked
// dot lattice: the ground grid, the background candlestick series, the
// floating tickers and the atmospheric haze.
//
// These are all authored directly in plane units (u across, v into the
// distance) rather than in lon/lat. Only the continents are geographic;
// the rest is furniture ruled onto the plane the map sits on, and phrasing
// it in degrees would imply a globe that isn't there.
//
// Every element's identity is a pure function of its index (via the shared
// mulberry32 PRNG) and every animated quantity is a pure function of
// (index, frame). Remotion renders frames out of order across workers, so
// anything seeded from Math.random() or Date.now() would pop between
// frames.

import { seededRandom } from "../particle-ring/random";
import {
  CANDLE_COUNT,
  CANDLE_U_MAX,
  CANDLE_U_MIN,
  CANDLE_V_MAX,
  CANDLE_V_MIN,
  GRID_DOT_SPACING,
  GRID_LINE_SPACING,
  GRID_U_MAX,
  GRID_U_MIN,
  GRID_V_MAX,
  GRID_V_MIN,
  HAZE_BLOB_COUNT,
  TICKER_COUNT,
} from "./constants";

// --- Ground grid --------------------------------------------------------

export type GridDot = {
  u: number;
  v: number;
  /** Every fourth line is drawn brighter, to give the grid a read. */
  major: boolean;
};

export const generateGridDots = (): GridDot[] => {
  const dots: GridDot[] = [];
  let lineIndex = 0;

  // Lines running into the distance. These are the ones that visibly
  // converge once projected.
  for (let u = GRID_U_MIN; u <= GRID_U_MAX + 1e-9; u += GRID_LINE_SPACING) {
    const major = lineIndex % 4 === 0;
    for (let v = GRID_V_MIN; v <= GRID_V_MAX + 1e-9; v += GRID_DOT_SPACING) {
      dots.push({ u, v, major });
    }
    lineIndex++;
  }

  // Lines running across. These stay parallel but bunch up with depth.
  lineIndex = 0;
  for (let v = GRID_V_MIN; v <= GRID_V_MAX + 1e-9; v += GRID_LINE_SPACING) {
    const major = lineIndex % 4 === 0;
    for (let u = GRID_U_MIN; u <= GRID_U_MAX + 1e-9; u += GRID_DOT_SPACING) {
      dots.push({ u, v, major });
    }
    lineIndex++;
  }

  return dots;
};

// --- Background candlestick series --------------------------------------

export type Candle = {
  u: number;
  openV: number;
  closeV: number;
  highV: number;
  lowV: number;
  /** True when the candle closed against the prevailing trend. */
  counterTrend: boolean;
};

/**
 * A random walk with a drift term, mapped into a band on the plane so it
 * can be drawn in perspective behind the continents. `direction` is the
 * drift sign: -1 walks the series down across the frame, +1 walks it up.
 */
export const generateCandles = (direction: -1 | 1): Candle[] => {
  const candles: Candle[] = [];
  const span = CANDLE_V_MAX - CANDLE_V_MIN;
  const uStep = (CANDLE_U_MAX - CANDLE_U_MIN) / CANDLE_COUNT;

  // Start high for a falling series and low for a rising one, so the trend
  // has the whole band to travel through.
  let price = direction < 0 ? 0.82 : 0.18;

  for (let i = 0; i < CANDLE_COUNT; i++) {
    const r1 = seededRandom(i, 11);
    const r2 = seededRandom(i, 23);
    const r3 = seededRandom(i, 37);

    const drift = direction * 0.0092;
    const noise = (r1 - 0.5) * 0.075;
    const open = price;
    price = Math.min(0.95, Math.max(0.05, price + drift + noise));
    const close = price;

    const high = Math.min(1, Math.max(open, close) + 0.012 + r2 * 0.032);
    const low = Math.max(0, Math.min(open, close) - (0.012 + r3 * 0.03));

    candles.push({
      u: CANDLE_U_MIN + i * uStep + uStep / 2,
      openV: CANDLE_V_MIN + open * span,
      closeV: CANDLE_V_MIN + close * span,
      highV: CANDLE_V_MIN + high * span,
      lowV: CANDLE_V_MIN + low * span,
      counterTrend: direction < 0 ? close > open : close < open,
    });
  }

  return candles;
};

// --- Tickers ------------------------------------------------------------

/** 0 = plain glowing text, 1 = solid accent chip, 2 = light quote-board chip. */
export type TickerStyle = 0 | 1 | 2;

export type Ticker = {
  u: number;
  v: number;
  elevation: number;
  style: TickerStyle;
  sizeScale: number;
  /** Offset into TICKER_PERIOD, so they do not all blink together. */
  cycleOffset: number;
  seed: number;
  /** Re-rolls its digits every few frames rather than once per cycle. */
  fastTick: boolean;
  showArrow: boolean;
  bobPhase: number;
};

export const generateTickers = (): Ticker[] => {
  const tickers: Ticker[] = [];
  for (let i = 0; i < TICKER_COUNT; i++) {
    const styleRoll = seededRandom(i, 211);
    // Weighted towards plain text, which is what the reference frame is
    // mostly made of, with the solid chips as accents.
    const style: TickerStyle = styleRoll < 0.46 ? 0 : styleRoll < 0.78 ? 1 : 2;

    tickers.push({
      // Spread past the frame edges so some are always entering or
      // leaving shot rather than every one sitting fully visible.
      u: -1.5 + seededRandom(i, 223) * 3,
      v: -0.62 + seededRandom(i, 227) * 1.35,
      elevation: 0.02 + seededRandom(i, 229) * 0.06,
      style,
      sizeScale: 0.78 + seededRandom(i, 233) * 0.62,
      cycleOffset: seededRandom(i, 239) * 90,
      seed: i,
      fastTick: seededRandom(i, 241) < 0.3,
      showArrow: seededRandom(i, 251) < 0.34,
      bobPhase: seededRandom(i, 257) * Math.PI * 2,
    });
  }
  return tickers;
};

/**
 * The number a ticker is showing. Derived from its seed plus a tick index
 * so the value changes as it re-rolls, staying in the 1.00-3.99 band the
 * reference footage uses.
 */
export const tickerValue = (seed: number, tick: number) =>
  1 + seededRandom(seed * 31 + tick * 7919, 263) * 2.99;

// --- Atmosphere ---------------------------------------------------------

// Haze sits in screen space rather than on the plane: it reads as lens
// glow and camera-facing atmosphere, so it should not foreshorten.
export type HazeBlob = {
  /** Centre, as a fraction of frame width/height. */
  x: number;
  y: number;
  /** Radius, as a fraction of frame width. */
  radius: number;
  alpha: number;
  driftX: number;
  driftY: number;
  phase: number;
};

export const generateHazeBlobs = (): HazeBlob[] => {
  const blobs: HazeBlob[] = [];
  for (let i = 0; i < HAZE_BLOB_COUNT; i++) {
    blobs.push({
      x: 0.08 + seededRandom(i, 307) * 0.84,
      y: 0.12 + seededRandom(i, 311) * 0.76,
      radius: 0.16 + seededRandom(i, 313) * 0.3,
      alpha: 0.025 + seededRandom(i, 317) * 0.05,
      driftX: (seededRandom(i, 331) - 0.5) * 0.06,
      driftY: (seededRandom(i, 337) - 0.5) * 0.04,
      phase: seededRandom(i, 347) * Math.PI * 2,
    });
  }
  return blobs;
};
