import { random } from "remotion";
import { MEAN_WINDOW, N_CANDLES } from "./config";

export type Candle = {
  open: number;
  close: number;
  high: number;
  low: number;
  /** ~25% of candles are solid rather than hollow outlines. */
  filled: boolean;
};

export type Series = {
  candles: Candle[];
  /** Closes, length N + 1, with closes[N] === closes[0] so the walk tiles. */
  closes: number[];
  /** Mean close over the trailing visible window, per candle index. */
  windowMean: Float64Array;
  min: number;
  max: number;
  /** Median absolute step, used as the natural scale for wick lengths. */
  unit: number;
};

/**
 * The walk is a program of trend regimes rather than pure noise: a decline,
 * a base, then a sustained climb, of 26 / 20 / 34 candles. Because the loop
 * forces the walk back to where it started, the program reads as a V-shaped
 * recovery — which is exactly the shape the shot wants.
 */
const PROGRAM = [
  { frac: 0.33, bias: -1.0, vol: 1.25 }, // decline
  { frac: 0.25, bias: -0.05, vol: 0.7 }, // base / chop
  { frac: 0.42, bias: 1.05, vol: 1.05 }, // sustained climb
] as const;

const BASE_PRICE = 2950;
const STEP_UNIT = 4.5;
const NOISE = 4.0;

const buildProgram = () => {
  const bias = new Float64Array(N_CANDLES);
  const vol = new Float64Array(N_CANDLES);
  let i = 0;
  for (let r = 0; r < PROGRAM.length; r++) {
    const reg = PROGRAM[r];
    const end =
      r === PROGRAM.length - 1
        ? N_CANDLES
        : Math.min(N_CANDLES, i + Math.round(reg.frac * N_CANDLES));
    const len = Math.max(1, end - i);
    for (let k = 0; k < len; k++) {
      // Ease the bias in and out of each regime so trends turn rather than snap.
      const t = (k + 0.5) / len;
      const ramp = Math.sin(Math.PI * t) * 0.45 + 0.75;
      bias[i + k] = reg.bias * ramp;
      vol[i + k] = reg.vol;
    }
    i = end;
  }
  return { bias, vol };
};

export const buildSeries = (): Series => {
  const { bias, vol } = buildProgram();

  // Per-candle magnitude. The cube gives a heavy tail: mostly small candles
  // with a handful of very large ones mixed in.
  const mag = new Float64Array(N_CANDLES);
  for (let i = 0; i < N_CANDLES; i++) {
    const u = random(`mag-${i}`);
    mag[i] = 0.55 + u * u * u * 3.4;
  }

  const step = new Float64Array(N_CANDLES);
  let sum = 0;
  for (let i = 0; i < N_CANDLES; i++) {
    const n = random(`walk-${i}`) * 2 - 1;
    step[i] = (bias[i] + n * vol[i] * NOISE) * mag[i] * STEP_UNIT;
    sum += step[i];
  }
  // Zero the net drift so close[N] lands exactly on close[0] and the series tiles.
  const mean = sum / N_CANDLES;
  for (let i = 0; i < N_CANDLES; i++) step[i] -= mean;

  const closes = new Array<number>(N_CANDLES + 1);
  closes[0] = BASE_PRICE;
  for (let i = 0; i < N_CANDLES; i++) closes[i + 1] = closes[i] + step[i];
  // Pin the wrap exactly; the mean subtraction leaves float residue otherwise.
  closes[N_CANDLES] = closes[0];

  const absSteps = Array.from(step, Math.abs).sort((a, b) => a - b);
  const unit = absSteps[Math.floor(absSteps.length / 2)] || 1;

  const candles: Candle[] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < N_CANDLES; i++) {
    const open = closes[i];
    const close = closes[i + 1];
    const hi = Math.max(open, close);
    const lo = Math.min(open, close);
    // Wicks scale off the candle's own range, floored by the series unit so
    // dojis still get a stalk. Roughly one in six is clipped to nothing.
    const span = Math.abs(close - open) + unit * 0.6;
    // Capped, or a big-bodied candle grows a wick long enough to read as a
    // stray line rather than part of the candle.
    const cap = unit * 4;
    const wick = (u: number) => Math.min(cap, Math.pow(u, 2.1) * span * 1.7);
    const up =
      random(`wick-up-zero-${i}`) < 0.17 ? 0 : wick(random(`wick-up-${i}`));
    const dn =
      random(`wick-dn-zero-${i}`) < 0.17 ? 0 : wick(random(`wick-dn-${i}`));
    const high = hi + up;
    const low = lo - dn;
    if (low < min) min = low;
    if (high > max) max = high;
    candles.push({
      open,
      close,
      high,
      low,
      filled: random(`fill-${i}`) < 0.25,
    });
  }

  // Rolling mean of the closes over one screen-width of candles. The price
  // axis rides this so the visible window stays framed instead of drifting
  // off the top or bottom as the walk trends. It is periodic in i, so it
  // closes with the loop like everything else.
  const windowMean = new Float64Array(N_CANDLES);
  let acc = 0;
  for (let k = 0; k < MEAN_WINDOW; k++) {
    acc += closes[(((N_CANDLES - k) % N_CANDLES) + N_CANDLES) % N_CANDLES];
  }
  for (let i = 0; i < N_CANDLES; i++) {
    windowMean[i] = acc / MEAN_WINDOW;
    acc += closes[(i + 1) % N_CANDLES];
    acc -=
      closes[(((i + 1 - MEAN_WINDOW) % N_CANDLES) + N_CANDLES) % N_CANDLES];
  }

  const pad = (max - min) * 0.06;
  return { candles, closes, windowMean, min: min - pad, max: max + pad, unit };
};
