import {random} from 'remotion';
import {SERIES_LEN} from './constants';

export type Candle = {
  /** Relative log-price levels. The exponential trend is added at draw time. */
  open: number;
  close: number;
  high: number;
  low: number;
  /** 0..1, drives the volume histogram bar height. */
  volume: number;
};

/** Positive modulo — global candle indices run negative off the left edge. */
export const wrap = (i: number, n: number): number => ((i % n) + n) % n;

/** Box–Muller from two seeded uniforms — deterministic across renders. */
const gauss = (seed: string): number => {
  const u = Math.max(random(`${seed}:u`), 1e-6);
  const v = random(`${seed}:v`);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** Rescales an array to peak-to-peak 1, centred on zero. */
const normalise = (a: number[]): number[] => {
  const lo = Math.min(...a);
  const hi = Math.max(...a);
  const range = hi - lo || 1;
  return a.map((x) => (x - lo) / range - 0.5);
};

/**
 * The series is built from two independent components, so the shape of the
 * chart and the size of its candles can be dialled separately:
 *
 *   envelope — smooth, low-frequency, sets how far the trace wanders vertically
 *   detail   — mean-reverting, sets how tall individual candles are
 *
 * A single random walk couples the two: shrink it to keep the trace on screen
 * and the candles shrink with it. Both components are exactly periodic over
 * SERIES_LEN, so candle i and candle i+SERIES_LEN are identical and the scroll
 * tiles seamlessly.
 */
const ENVELOPE_SWING = 0.17; // peak-to-peak, in log price
const DETAIL_SWING = 0.21;
/** Mean-reversion rate of the detail walk: ~8 candles of memory. */
const DETAIL_KAPPA = 0.28;

/**
 * A smooth, exactly-periodic trend bias.
 *
 * Integer harmonics of the series length close on themselves at the seam.
 * Harmonics 5/7/9 give runs of roughly 29–52 candles; harmonics 1–3 give the
 * longer arcs — a climb, a correction, a base, then a stronger climb. Negative
 * excursions are steepened so corrections read as sharp drops, not lazy drifts.
 */
const trendBias = (i: number): number => {
  const HARMONICS = [
    {m: 1, a: 1.0},
    {m: 2, a: 0.72},
    {m: 3, a: 0.5},
    {m: 5, a: 0.42},
    {m: 7, a: 0.3},
    {m: 9, a: 0.2},
  ];
  let raw = 0;
  for (const {m, a} of HARMONICS) {
    const phase = random(`bias-phase-${m}`) * Math.PI * 2;
    raw += a * Math.sin((2 * Math.PI * m * i) / SERIES_LEN + phase);
  }
  return raw < 0 ? raw * 2.05 : raw;
};

/** Generates the whole price series once. Never call this per frame. */
export const buildSeries = (): Candle[] => {
  const n = SERIES_LEN;

  // Envelope: the integral of a mean-removed periodic bias is itself periodic.
  const bias = Array.from({length: n}, (_, i) => trendBias(i));
  const biasMean = bias.reduce((a, b) => a + b, 0) / n;
  const cumulative = [0];
  for (let i = 0; i < n; i++) cumulative.push(cumulative[i] + (bias[i] - biasMean));
  const envelope = normalise(cumulative.slice(0, n));

  // Detail: per-candle impulses, with occasional much larger ones so the chart
  // carries the odd dramatic bar rather than a uniform picket fence.
  const impulse = Array.from({length: n}, (_, i) => {
    const spike = random(`spike-${i}`);
    const size = spike > 0.958 ? 4.6 : spike > 0.885 ? 2.4 : 0.5 + random(`size-${i}`) * 0.85;
    return gauss(`step-${i}`) * size;
  });

  // Mean-reverting walk over the impulses. Twelve passes around the loop drive
  // the transient below float precision, so the result is exactly periodic.
  const raw = new Array<number>(n);
  let v = 0;
  for (let pass = 0; pass < 12; pass++) {
    for (let i = 0; i < n; i++) {
      raw[i] = v;
      v = v * (1 - DETAIL_KAPPA) + impulse[i] * 0.01;
    }
  }
  const detail = normalise(raw);

  const level = (i: number) =>
    ENVELOPE_SWING * envelope[wrap(i, n)] + DETAIL_SWING * detail[wrap(i, n)];

  // Wrap into OHLC. close(i) === open(i+1), so the staircase has no gaps.
  return Array.from({length: n}, (_, i) => {
    const open = level(i);
    const close = level(i + 1);
    const body = Math.abs(close - open);
    const wickScale = 0.0025 + body * 0.5;
    return {
      open,
      close,
      high: Math.max(open, close) + random(`wu-${i}`) * wickScale,
      low: Math.min(open, close) - random(`wd-${i}`) * wickScale,
      volume: Math.min(1, (0.16 + random(`vol-${i}`) * 0.5) * (1 + (body / 0.012) * 0.35)),
    };
  });
};
