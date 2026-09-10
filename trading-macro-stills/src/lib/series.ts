import type { Rng } from "./rng";

export type Candle = {
  open: number;
  close: number;
  high: number;
  low: number;
  up: boolean;
  hollow: boolean;
};

/**
 * A seeded random walk with TRENDING RUNS: the drift is biased in one
 * direction for 20-40 candles at a time before flipping. Unbiased noise
 * reads as characterless — it is the runs that make the series look like a
 * market rather than a sample of static.
 */
export const makeCandles = (
  rng: Rng,
  count: number,
  opts: { volatility?: number; hollowRate?: number } = {},
): Candle[] => {
  const volatility = opts.volatility ?? 1;
  const hollowRate = opts.hollowRate ?? 0.22;

  let price = 100;
  let runLeft = 0;
  let drift = 0;
  const out: Candle[] = [];

  for (let i = 0; i < count; i++) {
    if (runLeft <= 0) {
      runLeft = rng.int(20, 40);
      // A run's strength varies, and a minority of runs are near-flat
      // consolidations rather than moves.
      drift = rng.range(-1, 1) * rng.range(0.35, 1.4);
      if (rng.chance(0.22)) drift *= 0.15;
    }
    runLeft--;

    const step = (drift * 0.55 + rng.range(-1, 1) * 1.6) * volatility;
    const open = price;
    const close = open + step;
    const wickUp = Math.abs(rng.range(0, 1)) * 2.6 * volatility + 0.2;
    const wickDown = Math.abs(rng.range(0, 1)) * 2.6 * volatility + 0.2;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;
    price = close;

    out.push({
      open,
      close,
      high,
      low,
      up: close >= open,
      hollow: rng.chance(hollowRate),
    });
  }
  return out;
};

/** Mid price of each candle — the input every curve is smoothed from. */
export const midline = (candles: Candle[]): number[] =>
  candles.map((c) => (c.open + c.close) / 2);

/**
 * Exponential moving average. Curves are built from this so they genuinely
 * follow the candle series they sit over, which is what makes them read as
 * indicators rather than decoration.
 */
export const ema = (values: number[], window: number): number[] => {
  if (values.length === 0) return [];
  const k = 2 / (window + 1);
  let acc = values[0];
  const out: number[] = [];
  for (const v of values) {
    acc = v * k + acc * (1 - k);
    out.push(acc);
  }
  return out;
};

/** Second pass, run backwards, to remove the lag an EMA introduces. */
export const smooth = (values: number[], window: number): number[] => {
  const fwd = ema(values, window);
  const back = ema([...fwd].reverse(), window).reverse();
  return back;
};

export const extent = (values: number[]): [number, number] => {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === hi) return [lo - 1, hi + 1];
  return [lo, hi];
};

/** Resample a series to `n` points with linear interpolation. */
export const resample = (values: number[], n: number): number[] => {
  if (values.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / Math.max(1, n - 1)) * (values.length - 1);
    const a = Math.floor(t);
    const b = Math.min(values.length - 1, a + 1);
    out.push(values[a] + (values[b] - values[a]) * (t - a));
  }
  return out;
};
