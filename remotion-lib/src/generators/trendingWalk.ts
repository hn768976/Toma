/**
 * trendingWalk — a seeded random walk with biased runs.
 *
 * WHAT: Produces a price-like series. Instead of drawing an independent step
 * each tick, it commits to a RUN of a chosen direction lasting a seeded number
 * of ticks, then reverses or continues.
 *
 * WHY NOT A PLAIN RANDOM WALK: independent steps produce something that reads
 * as flat noise. It has no runs, no reversals you can point at, no structure a
 * viewer can follow — and on a chart it looks like a seismograph, not a market.
 * Committing to runs is what produces recognisable structure: a trend, a
 * pullback, a reversal. This is the difference between a chart that reads as
 * data and one that reads as static.
 *
 * PARAMETERS
 *   length      Number of points. Default 120.
 *   rng         Seeded generator. Required.
 *   bias        Net direction: 1 rising, -1 falling, 0 sideways. Default 1.
 *               Applied as a probability skew on run direction, not as a drift
 *               added to every step — so a bull series still has real pullbacks
 *               rather than a tilted noise band.
 *   biasStrength How strongly `bias` skews run direction, 0..1. 0 makes runs
 *               equally likely either way; 1 makes every run follow the bias.
 *               Default 0.62.
 *   runLength   [min, max] ticks per run. Default [6, 18]. Short ranges read as
 *               chop; long ranges read as a trend.
 *   volatility  Step size as a fraction of `start`. Default 0.012.
 *   start       Opening value. Default 100.
 *   closeLoop   If true the series is corrected so the last value equals the
 *               first, which lets the result TILE seamlessly. Default false.
 *               The correction is distributed across all steps, so it does not
 *               show as a kink.
 *
 * RETURNS `{ values, min, max, candles }`. `candles` gives OHLC per step for
 * candlestick rendering: each candle runs from values[i] to values[i+1], with
 * seeded wicks beyond the body.
 *
 * GOTCHA: `closeLoop` forces net drift to zero. A looping series therefore
 * cannot also have a net rise — the bullish or bearish character has to come
 * from run structure alone (which is exactly how the source projects did it).
 *
 * EXAMPLE
 *   const { values, candles } = trendingWalk({ length: 90, rng, bias: -1 });
 */
import type { Rng } from '../types';

export type Candle = {
  index: number;
  open: number;
  close: number;
  high: number;
  low: number;
  rising: boolean;
};

export type TrendingWalkOptions = {
  rng: Rng;
  length?: number;
  bias?: -1 | 0 | 1;
  biasStrength?: number;
  runLength?: [number, number];
  volatility?: number;
  start?: number;
  closeLoop?: boolean;
};

export type TrendingWalkResult = {
  values: number[];
  candles: Candle[];
  min: number;
  max: number;
  /** Mean absolute step, the natural scale unit for sizing wicks and gaps. */
  unit: number;
};

export const trendingWalk = ({
  rng,
  length = 120,
  bias = 1,
  biasStrength = 0.62,
  runLength = [6, 18],
  volatility = 0.012,
  start = 100,
  closeLoop = false,
}: TrendingWalkOptions): TrendingWalkResult => {
  const step = start * volatility;
  const [runMin, runMax] = runLength;

  const values: number[] = [start];
  let value = start;
  let remaining = 0;
  let direction = bias === 0 ? 1 : bias;

  for (let i = 1; i < length; i++) {
    if (remaining <= 0) {
      // Start a new run. Direction is skewed toward `bias` by `biasStrength`,
      // so counter-trend runs still happen — they are just shorter-lived.
      const pBias = 0.5 + (bias === 0 ? 0 : bias * biasStrength * 0.5);
      direction = rng() < pBias ? 1 : -1;
      remaining =
        Math.floor(runMin + rng() * Math.max(0, runMax - runMin)) + 1;
      // A counter-trend run is shorter than a with-trend run. This asymmetry is
      // what makes a bull series grind up and drop fast, rather than looking
      // like a symmetric zigzag.
      if (bias !== 0 && direction !== bias) {
        remaining = Math.max(2, Math.round(remaining * 0.55));
      }
    }

    // Magnitude varies per tick so a run is not a straight ramp.
    const magnitude = step * (0.35 + rng() * 1.3);
    value += direction * magnitude;
    values.push(value);
    remaining--;
  }

  if (closeLoop && values.length > 1) {
    // Spread the correction over the series so no single step shows a kink.
    const drift = values[values.length - 1] - values[0];
    for (let i = 0; i < values.length; i++) {
      values[i] -= (drift * i) / (values.length - 1);
    }
  }

  // Mean absolute step, used to size wicks proportionally to the series' own
  // scale rather than to an absolute constant.
  let sum = 0;
  for (let i = 1; i < values.length; i++) {
    sum += Math.abs(values[i] - values[i - 1]);
  }
  const unit = values.length > 1 ? sum / (values.length - 1) : step;

  const candles: Candle[] = [];
  for (let i = 0; i < values.length - 1; i++) {
    const open = values[i];
    const close = values[i + 1];
    const hi = Math.max(open, close) + rng() * unit * 0.9;
    const lo = Math.min(open, close) - rng() * unit * 0.9;
    candles.push({
      index: i,
      open,
      close,
      high: hi,
      low: lo,
      rising: close >= open,
    });
  }

  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  if (candles.length === 0) {
    min = Math.min(...values);
    max = Math.max(...values);
  }

  return { values, candles, min, max, unit };
};
