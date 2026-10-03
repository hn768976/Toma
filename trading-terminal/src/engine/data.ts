// Data engine shared by every shot. All series are generated once at module
// level from each version's seed; per-frame state is a pure function of the
// frame number.

import { clamp, easeOutCubic, gaussian, lerp, mulberry32 } from "./random";
import { Version, VERSIONS } from "./versions";

export const FPS = 30;
export const DURATION = 450;
/** A candle takes 1.5 s to print. */
export const CANDLE_FRAMES = 45;
/** The live price ticks every 3 frames -> 15 ticks per candle. */
export const TICK_FRAMES = 3;
export const TICKS = CANDLE_FRAMES / TICK_FRAMES; // 15
/** Clip frame 0 starts mid-candle, so the first close happens ~0.8 s in. */
export const CLOCK_OFFSET = 20;
/** Closed candles that exist before frame 0. */
export const HISTORY = 320;
const FUTURE = Math.ceil((DURATION + CLOCK_OFFSET) / CANDLE_FRAMES) + 2;

export interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  /** Intra-candle price path: ticks[0] = open, ticks[TICKS-1] = close. */
  ticks: number[];
}

export interface Series {
  candles: Candle[];
  /** Independent jagged walks for the area charts (one point per 5 frames). */
  areaMain: number[];
  areaSide: number[];
}

const generate = (v: Version): Series => {
  const rnd = mulberry32(v.seed);
  const n = HISTORY + FUTURE;
  const candles: Candle[] = [];
  let price = v.startPrice;
  let mom = 0;
  for (let i = 0; i < n; i++) {
    // Trend strengthens over the last stretch so the printed candles follow it.
    const late = i > HISTORY - 30 ? 1.5 : 1;
    // Slow swing gives realistic counter-trend bounces.
    const swing = Math.sin(i * 0.21 + v.seed) * v.vol * 0.55;
    mom = v.momentum * mom + v.vol * gaussian(rnd);
    const r = v.drift * late + mom + swing;
    const o = price;
    const c = o * Math.exp(r);
    // Brownian bridge from o to c with wicks.
    const ticks: number[] = [o];
    const sd = Math.abs(o) * v.vol * 0.55;
    let w = 0;
    const walk: number[] = [0];
    for (let k = 1; k < TICKS; k++) {
      w += gaussian(rnd) * sd / Math.sqrt(TICKS);
      walk.push(w);
    }
    for (let k = 1; k < TICKS; k++) {
      const s = k / (TICKS - 1);
      ticks.push(lerp(o, c, s) + walk[k] - s * walk[TICKS - 1]);
    }
    ticks[TICKS - 1] = c;
    let h = -Infinity;
    let l = Infinity;
    for (const t of ticks) {
      h = Math.max(h, t);
      l = Math.min(l, t);
    }
    const down = c < o;
    const trendSide = v.drift < 0 ? down : v.drift > 0 ? !down : true;
    const vol =
      (0.45 + rnd() * 0.7 + (Math.abs(r) / v.vol) * 0.35) *
      (trendSide ? 1.35 : 0.85);
    candles.push({ o, h, l, c, v: vol, ticks });
    price = c;
  }
  // Rescale so the clip opens near the version's start price.
  const k = v.startPrice / candles[HISTORY].o;
  for (const c of candles) {
    c.o *= k;
    c.h *= k;
    c.l *= k;
    c.c *= k;
    for (let j = 0; j < c.ticks.length; j++) c.ticks[j] *= k;
  }

  const walk = (len: number, drift: number, jag: number, start: number) => {
    const out: number[] = [];
    let x = start;
    let m = 0;
    for (let i = 0; i < len; i++) {
      m = 0.3 * m + gaussian(rnd) * jag;
      x += drift + m;
      out.push(x);
    }
    return out;
  };
  const dir = Math.sign(v.drift) || 0.2;
  const areaMain = walk(260, dir * 0.0042, 0.012, 1);
  const areaSide = walk(260, -dir * 0.0016, 0.009, 1);
  return { candles, areaMain, areaSide };
};

const SERIES = new Map<string, Series>();
for (const v of VERSIONS) SERIES.set(v.id, generate(v));
export const getSeries = (v: Version) => SERIES.get(v.id)!;

// ---------------------------------------------------------------------------
// Clock

export interface Clock {
  /** Frame on the market clock (clip frame + offset). */
  g: number;
  /** Global tick index. */
  tick: number;
  /** Candles closed since frame 0. */
  n: number;
  /** Index of the live candle in the series. */
  live: number;
  /** Tick inside the live candle (0..TICKS-1). */
  k: number;
  /** 0..1 progress through the live candle. */
  t: number;
  /** Remaining scroll (1 -> 0) right after a candle closes. */
  scroll: number;
}

export const clockAt = (frame: number): Clock => {
  const g = frame + CLOCK_OFFSET;
  const tick = Math.floor(g / TICK_FRAMES);
  const n = Math.floor(g / CANDLE_FRAMES);
  const inCandle = g - n * CANDLE_FRAMES;
  return {
    g,
    tick,
    n,
    live: HISTORY + n,
    k: Math.floor(inCandle / TICK_FRAMES),
    t: inCandle / CANDLE_FRAMES,
    scroll: 1 - easeOutCubic(inCandle / 12),
  };
};

/** Candle `i` as seen at global tick `tick` (live candle is partial). */
export const candleAt = (s: Series, i: number, tick: number): Candle | null => {
  const live = HISTORY + Math.floor(tick / TICKS);
  if (i > live) return null;
  const c = s.candles[i];
  if (i < live) return c;
  const k = tick - Math.floor(tick / TICKS) * TICKS;
  let h = -Infinity;
  let l = Infinity;
  for (let j = 0; j <= k; j++) {
    h = Math.max(h, c.ticks[j]);
    l = Math.min(l, c.ticks[j]);
  }
  return { o: c.o, h, l, c: c.ticks[k], v: c.v * (0.15 + 0.85 * (k + 1) / TICKS), ticks: c.ticks };
};

export const priceAtTick = (s: Series, tick: number) => {
  const live = HISTORY + Math.floor(tick / TICKS);
  return s.candles[live].ticks[tick - Math.floor(tick / TICKS) * TICKS];
};

// ---------------------------------------------------------------------------
// Indicators over a window ending at the live candle

export interface Window {
  /** First series index of the window. */
  start: number;
  candles: Candle[];
  ema: number[];
  sma: number[];
  bandUp: number[];
  bandLo: number[];
  stochK: number[];
  stochD: number[];
  /** RSI(9) and its EMA(3) signal – the oscillator panel's two lines. */
  rsi: number[];
  rsiSig: number[];
  macd: number[];
  signal: number[];
  hist: number[];
}

const WARMUP = 80;

/** Indicators for the `count` candles ending at the live candle of `tick`. */
export const windowAt = (s: Series, tick: number, count: number): Window => {
  const live = HISTORY + Math.floor(tick / TICKS);
  const first = live - count + 1;
  const from = first - WARMUP;
  const cs: Candle[] = [];
  for (let i = from; i <= live; i++) cs.push(candleAt(s, i, tick)!);
  const closes = cs.map((c) => c.c);
  const N = cs.length;

  const emaOf = (src: number[], p: number) => {
    const a = 2 / (p + 1);
    const out: number[] = [];
    let e = src[0];
    for (let i = 0; i < src.length; i++) {
      e = i === 0 ? src[0] : a * src[i] + (1 - a) * e;
      out.push(e);
    }
    return out;
  };
  const ema = emaOf(closes, 20);
  const sma: number[] = [];
  const bandUp: number[] = [];
  const bandLo: number[] = [];
  for (let i = 0; i < N; i++) {
    let sum = 0;
    let cnt = 0;
    for (let j = Math.max(0, i - 49); j <= i; j++) {
      sum += closes[j];
      cnt++;
    }
    sma.push(sum / cnt);
    let m = 0;
    let q = 0;
    let c2 = 0;
    for (let j = Math.max(0, i - 19); j <= i; j++) {
      m += closes[j];
      q += closes[j] * closes[j];
      c2++;
    }
    m /= c2;
    const sd = Math.sqrt(Math.max(0, q / c2 - m * m));
    bandUp.push(ema[i] + 2 * sd);
    bandLo.push(ema[i] - 2 * sd);
  }
  const rawK: number[] = [];
  for (let i = 0; i < N; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = Math.max(0, i - 13); j <= i; j++) {
      hh = Math.max(hh, cs[j].h);
      ll = Math.min(ll, cs[j].l);
    }
    rawK.push(hh - ll < 1e-12 ? 50 : ((closes[i] - ll) / (hh - ll)) * 100);
  }
  const smooth = (src: number[], p: number) =>
    src.map((_, i) => {
      let sum = 0;
      let c = 0;
      for (let j = Math.max(0, i - p + 1); j <= i; j++) {
        sum += src[j];
        c++;
      }
      return sum / c;
    });
  const stochK = smooth(rawK, 3);
  const stochD = smooth(stochK, 3);
  // Wilder RSI(9)
  const rsi: number[] = [50];
  let ag = 0;
  let al = 0;
  for (let i = 1; i < N; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = Math.max(0, d);
    const loss = Math.max(0, -d);
    if (i <= 9) {
      ag += gain / 9;
      al += loss / 9;
    } else {
      ag = (ag * 8 + gain) / 9;
      al = (al * 8 + loss) / 9;
    }
    rsi.push(al < 1e-12 ? 100 : 100 - 100 / (1 + ag / al));
  }
  const rsiSig = emaOf(rsi, 3);
  const e12 = emaOf(closes, 12);
  const e26 = emaOf(closes, 26);
  const macd = e12.map((x, i) => x - e26[i]);
  const signal = emaOf(macd, 9);
  const hist = macd.map((x, i) => x - signal[i]);
  const cut = <T,>(a: T[]) => a.slice(WARMUP);
  return {
    start: first,
    candles: cut(cs),
    ema: cut(ema),
    sma: cut(sma),
    bandUp: cut(bandUp),
    bandLo: cut(bandLo),
    stochK: cut(stochK),
    stochD: cut(stochD),
    rsi: cut(rsi),
    rsiSig: cut(rsiSig),
    macd: cut(macd),
    signal: cut(signal),
    hist: cut(hist),
  };
};

/** Last values at a tick – used by the rolling value tags. */
export const lastValues = (s: Series, tick: number) => {
  const w = windowAt(s, tick, 2);
  const i = w.candles.length - 1;
  return {
    price: w.candles[i].c,
    open: w.candles[i].o,
    vol: w.candles[i].v,
    ema: w.ema[i],
    sma: w.sma[i],
    bandUp: w.bandUp[i],
    bandLo: w.bandLo[i],
    k: w.stochK[i],
    d: w.stochD[i],
    rsi: w.rsi[i],
    rsiSig: w.rsiSig[i],
    macd: w.macd[i],
    signal: w.signal[i],
    hist: w.hist[i],
  };
};

/**
 * Price range of the visible window, changing only at candle boundaries and
 * blended across the scroll so the axis never jumps.
 */
export const priceRange = (s: Series, clock: Clock, count: number, padFrac = 0.08) => {
  const rangeFor = (n: number) => {
    const live = HISTORY + n;
    let hi = -Infinity;
    let lo = Infinity;
    for (let i = live - count + 1; i <= live; i++) {
      hi = Math.max(hi, s.candles[i].h);
      lo = Math.min(lo, s.candles[i].l);
    }
    const pad = (hi - lo) * padFrac;
    return [lo - pad, hi + pad] as const;
  };
  const a = rangeFor(clock.n - 1);
  const b = rangeFor(clock.n);
  const e = 1 - clock.scroll;
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e)] as const;
};

/** Range for an arbitrary per-candle series, blended the same way. */
export const blendRange = (
  clock: Clock,
  rangeForN: (n: number) => readonly [number, number],
) => {
  const a = rangeForN(clock.n - 1);
  const b = rangeForN(clock.n);
  const e = 1 - clock.scroll;
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e)] as const;
};

export { clamp };
