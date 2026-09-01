import { rnd, rndRange } from "./rng";
import type { Plane } from "./plane";

/** One candle. All values are in normalised price units. */
export type Candle = {
  open: number;
  close: number;
  high: number;
  low: number;
  up: boolean;
};

export type Series = {
  /** Length of the cycle. Index i and i + count are the same candle. */
  count: number;
  /** Distance between candle centres, in plane units. */
  pitch: number;
  candles: Candle[];
  /** Volume in 0..1, one per candle, cyclic by construction. */
  volume: number[];
  /** One array of closes-averages per configured smoothing length. */
  movingAverages: number[][];
  /** Range the candles span, used to map price to plane y. */
  min: number;
  max: number;
};

/** Target distance between candle centres at 4K. Body 16px, gap 24px. */
const CANDLE_PITCH = 40;

/**
 * A seeded random walk with trending runs: the drift is re-biased every 25-50
 * candles, which is what gives the series recognisable structure instead of
 * characterless noise.
 *
 * The walk is then linearly detrended so that value[count] === value[0] and
 * the series is genuinely cyclic — the chart can scroll forever and the
 * 600-frame loop still closes.
 */
const trendingWalk = (seed: string, count: number): number[] => {
  const deltas: number[] = new Array(count);
  let i = 0;
  let run = 0;
  let bias = 0;
  while (i < count) {
    const runLength = Math.round(rndRange(`${seed}-runlen-${run}`, 25, 50));
    // Alternate the sign more often than not so runs read as reversals.
    const strength = rndRange(`${seed}-runbias-${run}`, 0.18, 0.62);
    bias = rnd(`${seed}-rundir-${run}`) < 0.5 ? -strength : strength;
    for (let j = 0; j < runLength && i < count; j += 1, i += 1) {
      deltas[i] = bias + rndRange(`${seed}-step-${i}`, -1, 1);
    }
    run += 1;
  }

  const values: number[] = new Array(count);
  let v = 0;
  for (let k = 0; k < count; k += 1) {
    values[k] = v;
    v += deltas[k];
  }
  // `v` is now value[count]; remove the net drift so the series wraps.
  for (let k = 0; k < count; k += 1) {
    values[k] -= (v * k) / count;
  }
  return values;
};

/** Trailing mean over a window that wraps around the cycle. */
const cyclicMean = (values: number[], length: number): number[] => {
  const n = values.length;
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    for (let j = 0; j < length; j += 1) {
      sum += values[(i - j + n * length) % n];
    }
    out[i] = sum / length;
  }
  return out;
};

export const buildSeries = (
  plane: Plane,
  maLengths: number[],
  seed = "datawall-price",
): Series => {
  // Snap the candle count so that an exact whole number of candles fits one
  // tile; otherwise the series would jump at the tile seam.
  const count = Math.max(24, Math.round(plane.tileW / CANDLE_PITCH));
  const pitch = plane.tileW / count;

  const closes = trendingWalk(seed, count);

  const candles: Candle[] = new Array(count);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const close = closes[i];
    const open = closes[(i - 1 + count) % count];
    const body = Math.abs(close - open);
    const wickUp = body * 0.4 + rndRange(`${seed}-wu-${i}`, 0.25, 1.9);
    const wickDown = body * 0.4 + rndRange(`${seed}-wd-${i}`, 0.25, 1.9);
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;
    candles[i] = { open, close, high, low, up: close >= open };
    if (low < min) min = low;
    if (high > max) max = high;
  }

  // Volume: its own seeded series, lightly smoothed and nudged up where the
  // price moved hard, which is how a real board looks.
  const rawVolume: number[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const move = Math.abs(candles[i].close - candles[i].open);
    rawVolume[i] = rnd(`${seed}-vol-${i}`) * 0.75 + Math.min(move / 3, 1) * 0.45;
  }
  const smoothed = cyclicMean(rawVolume, 3);
  const vMax = Math.max(...smoothed);
  const volume = smoothed.map((v) => Math.max(0.06, v / vMax));

  const movingAverages = maLengths.map((len) => cyclicMean(closes, len));

  return { count, pitch, candles, volume, movingAverages, min, max };
};
