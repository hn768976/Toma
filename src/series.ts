import {random} from 'remotion';
import {SERIES_LEN, VARIANTS, type Variant} from './config';

/**
 * Seeded price-series construction.
 *
 * Everything here is a pure function of (variant, index) via Remotion's
 * `random()` with stable string seeds — never `Math.random()` — so the series
 * is byte-identical on every render, on every machine.
 *
 * The series is built to TILE. Candle `i` runs from price[i] to price[i+1] and
 * price[N] === price[0] exactly, so drawing the series twice offset by one
 * series width produces no seam. Closing the loop forces the sum of the
 * per-candle moves to be zero, so the bearish / bullish character is carried
 * by *structure* rather than by net drift: run length, which direction moves
 * fast and which grinds, volatility, wick frequency, body size, the colour
 * split, and where the trend line sits.
 */

export type Candle = {
  /** index within the tile */
  i: number;
  open: number;
  close: number;
  high: number;
  low: number;
  /** 0..1, drives bar height */
  volume: number;
  hollow: boolean;
  rising: boolean;
};

export type Series = {
  candles: Candle[];
  /** length SERIES_LEN + 1, price[N] === price[0] */
  price: number[];
  min: number;
  max: number;
  /** mean absolute close-to-close move, the natural scale unit */
  unit: number;
};

type SegmentKind =
  | 'run'
  | 'capitulation'
  | 'failedRally'
  | 'consolidation'
  | 'pullback'
  | 'retrace';

type Segment = {
  kind: SegmentKind;
  len: number;
  /** price units per candle */
  slope: number;
  /** noise multiplier */
  vol: number;
  bodyMul: number;
  wickMul: number;
};

/**
 * BEAR — volatile and choppy.
 *
 * Short violent declines against longer grinding recoveries, which is what
 * makes the reds larger while keeping the colour counts roughly balanced. One
 * capitulation (much the steepest thing in the series) and two failed rallies
 * that each retrace ~40% of the drop before them and then roll over.
 *
 * The slopes are chosen so sum(slope * len) === 0 and the tile closes.
 */
const BEAR_PLAN: Segment[] = [
  {kind: 'run', len: 20, slope: -1.1, vol: 1.0, bodyMul: 1.0, wickMul: 1.0},
  // failed rally #1 — recovers 8.8 of the preceding 22.0 drop (40%)
  {kind: 'failedRally', len: 22, slope: 0.4, vol: 0.95, bodyMul: 0.9, wickMul: 1.1},
  {kind: 'run', len: 18, slope: -1.05, vol: 1.05, bodyMul: 1.05, wickMul: 1.0},
  {kind: 'run', len: 24, slope: 0.75, vol: 0.9, bodyMul: 0.95, wickMul: 1.0},
  // capitulation — near-vertical, steeper than anything else here
  {kind: 'capitulation', len: 11, slope: -2.3, vol: 0.8, bodyMul: 1.4, wickMul: 0.65},
  // failed rally #2 — recovers 10.12 of the preceding 25.3 capitulation (40%)
  {kind: 'failedRally', len: 20, slope: 0.506, vol: 0.95, bodyMul: 0.9, wickMul: 1.15},
  // ...and rolls over
  {kind: 'run', len: 9, slope: -0.85, vol: 1.0, bodyMul: 1.0, wickMul: 1.05},
  // the tile's return leg: a choppy, unconvincing grind off the low
  {kind: 'retrace', len: 26, slope: 1.42038, vol: 1.1, bodyMul: 0.85, wickMul: 1.15},
];

/**
 * BULL — orderly advance.
 *
 * Long green runs, short shallow red pullbacks that are fully recovered within
 * a few candles, and one 30-candle consolidation at the tile's midpoint in
 * place of a dramatic event. Deliberately NOT v1 mirrored: markets climb
 * slowly and fall fast, so the shapes are different, not inverted.
 *
 * Closing the loop still costs one round trip, so the advance is given back
 * across two orderly, low-volatility retracement legs rather than one plunge.
 * Splitting it that way keeps the price wandering through the middle of the
 * band instead of parking against the top for half the loop.
 */
const BULL_PLAN: Segment[] = [
  {kind: 'run', len: 38, slope: 0.5, vol: 0.88, bodyMul: 1.0, wickMul: 1.0},
  // brief sharp pullback #1 — 4 candles, -7.6
  {kind: 'pullback', len: 4, slope: -1.9, vol: 1.05, bodyMul: 1.15, wickMul: 1.2},
  // ...fully recovered within the next 8 candles (+7.2 against -7.6, and the
  // noise carries the rest)
  {kind: 'run', len: 8, slope: 0.9, vol: 0.88, bodyMul: 1.1, wickMul: 1.0},
  // first give-back leg — orderly, low volatility, small bodies
  {kind: 'retrace', len: 19, slope: -1.3, vol: 0.75, bodyMul: 0.85, wickMul: 0.9},
  // consolidation — 30 small-bodied candles moving sideways, at the tile's
  // midpoint, standing in for v1's capitulation as the dramatic beat
  {kind: 'consolidation', len: 30, slope: 0.2, vol: 0.62, bodyMul: 0.6, wickMul: 1.0},
  // the trend resumes
  {kind: 'run', len: 30, slope: 0.5, vol: 0.88, bodyMul: 1.0, wickMul: 1.0},
  // brief sharp pullback #2 — 4 candles, -7.8
  {kind: 'pullback', len: 4, slope: -1.95, vol: 1.05, bodyMul: 1.15, wickMul: 1.2},
  // ...fully recovered within the next 7 candles
  {kind: 'run', len: 7, slope: 1.05, vol: 0.88, bodyMul: 1.1, wickMul: 1.0},
  // second give-back leg, closing the tile
  {kind: 'retrace', len: 10, slope: -1.445, vol: 0.75, bodyMul: 0.85, wickMul: 0.9},
];

const PLANS: Record<Variant, Segment[]> = {bear: BEAR_PLAN, bull: BULL_PLAN};

/** Box–Muller, from two stably seeded uniforms. */
const gauss = (seed: string): number => {
  const u = Math.max(1e-9, random(`${seed}-u`));
  const v = random(`${seed}-v`);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** Expand the segment plan into one entry per candle. */
const expandPlan = (plan: Segment[]): Segment[] => {
  const out: Segment[] = [];
  for (const seg of plan) {
    for (let k = 0; k < seg.len; k++) out.push(seg);
  }
  return out;
};

export const buildSeries = (variant: Variant): Series => {
  const cfg = VARIANTS[variant];
  const plan = PLANS[variant];
  const N = SERIES_LEN;

  const perCandle = expandPlan(plan);
  if (perCandle.length !== N) {
    throw new Error(
      `${variant} plan covers ${perCandle.length} candles, expected ${N}`
    );
  }

  // ── 1. close-to-close moves: segment drift + seeded noise ────────────────
  const move = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    const seg = perCandle[i];
    const noise = gauss(`${cfg.seed}-move-${i}`) * cfg.volatility * seg.vol;
    move[i] = seg.slope + noise;
  }

  // ── 2. force the tile closed: the moves must sum to exactly zero ─────────
  let sum = 0;
  for (let i = 0; i < N; i++) sum += move[i];
  const correction = sum / N;
  for (let i = 0; i < N; i++) move[i] -= correction;

  // ── 3. integrate into a cyclic price path ────────────────────────────────
  const price = new Array<number>(N + 1);
  price[0] = 0;
  for (let i = 0; i < N; i++) price[i + 1] = price[i] + move[i];
  price[N] = price[0]; // exact, not merely near

  let unit = 0;
  for (let i = 0; i < N; i++) unit += Math.abs(move[i]);
  unit /= N;

  // ── 4. candles ───────────────────────────────────────────────────────────
  const candles: Candle[] = [];
  for (let i = 0; i < N; i++) {
    const seg = perCandle[i];
    const raw = price[i + 1] - price[i];
    const rising = raw >= 0;

    // Which colour this variant wants to read as larger.
    const favoured = cfg.trendBias > 0 ? rising : !rising;

    // The opening gap. Real candles open away from the previous close, and a
    // small seeded gap lets the drawn bodies favour one colour without
    // disturbing the closing path, which has to stay net-zero to tile.
    const g = 0.55 + 0.75 * random(`${cfg.seed}-gap-${i}`);
    const stretch = favoured
      ? 1 + cfg.gapBias * g
      : 1 - cfg.gapBias * g * 0.8;

    let body = raw * cfg.bodySize * seg.bodyMul * stretch;
    const minBody = 0.14 * unit;
    if (Math.abs(body) < minBody) body = (rising ? 1 : -1) * minBody;

    const close = price[i + 1];
    const open = close - body;

    // Wicks: thin, and on the bear side, long and frequent.
    const wickScale = cfg.wickLength * seg.wickMul * cfg.volatility * unit;
    const wick = (which: string) => {
      const present = random(`${cfg.seed}-wp-${which}-${i}`) < cfg.wickFrequency;
      const r = random(`${cfg.seed}-wl-${which}-${i}`);
      const len = present ? 0.5 + 2.7 * r * r : 0.08 + 0.32 * r;
      return len * wickScale;
    };

    const hi = Math.max(open, close) + wick('up');
    const lo = Math.min(open, close) - wick('dn');

    // Volume tracks how much the candle actually moved, plus seeded texture.
    // Skewed low so the profile stays spiky: a flat-topped volume band reads as
    // a solid block once it is blurred.
    const vr = random(`${cfg.seed}-vol-${i}`);
    const vr2 = random(`${cfg.seed}-vol2-${i}`);
    const drive = Math.min(2.2, Math.abs(body) / Math.max(1e-6, unit));
    const volume = Math.min(
      1,
      0.07 + 0.66 * Math.pow(vr, 1.8) + 0.3 * drive * (0.35 + 0.95 * vr2)
    );

    candles.push({
      i,
      open,
      close,
      high: hi,
      low: lo,
      volume,
      hollow: random(`${cfg.seed}-hollow-${i}`) < cfg.hollowRate,
      rising,
    });
  }

  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }

  return {candles, price, min, max, unit};
};

/**
 * The rightmost candle is still FORMING: its close drifts, so the body grows,
 * shrinks and can flip colour until the scroll locks it.
 *
 * `t` runs 0 (just born) → 1 (locked). At t === 1 this returns the candle
 * unchanged, which is what keeps the loop exact.
 */
export const formCandle = (
  c: Candle,
  t: number,
  unit: number,
  seed: string
): Candle => {
  if (t >= 1) return c;
  const u = Math.max(0, t);
  // ease-out so the close settles rather than arriving linearly
  const ease = 1 - (1 - u) * (1 - u);
  const decay = Math.pow(1 - u, 1.5);
  // fade the wobble in from nothing so a candle is born as a dot, not a pop
  const birth = Math.min(1, u / 0.12);

  const phase = random(`${seed}-form-p-${c.i}`);
  const rate = 1.6 + 2.2 * random(`${seed}-form-r-${c.i}`);
  const amp = (0.75 + 0.95 * random(`${seed}-form-a-${c.i}`)) * unit;

  const wobble = Math.sin(2 * Math.PI * (phase + u * rate)) * amp * decay * birth;
  const close = c.open + (c.close - c.open) * ease + wobble;

  const lockedHi = Math.max(c.open, c.close);
  const lockedLo = Math.min(c.open, c.close);
  const high = Math.max(c.open, close) + (c.high - lockedHi) * ease;
  const low = Math.min(c.open, close) - (lockedLo - c.low) * ease;

  return {
    ...c,
    close,
    high,
    low,
    volume: c.volume * ease,
    rising: close >= c.open,
  };
};
