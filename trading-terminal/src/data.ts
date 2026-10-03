import { gaussian, mulberry32 } from "./rng";
import { SignalLabel, Version, VERSIONS } from "./versions";

// ---------------------------------------------------------------------------
// Timing (frames @ 30fps)
// ---------------------------------------------------------------------------
export const FPS = 30;
export const DURATION = 450;
/** A candle forms over this many frames (1.5s), then closes. */
export const CANDLE_FRAMES = 45;
/** The chart scrolls one candle left over this many frames after a close. */
export const SCROLL_FRAMES = 10;
/** Live values update in ticks of this many frames. */
export const TICK = 4;
/** A price tag rolls to its new value over this many frames. */
export const ROLL = 3;

export const N_CANDLES = 230;
/** Index of the candle that is forming at frame 0. */
export const LIVE_START = 205;
/** Candle slots kept in the y-range window. */
export const VISIBLE = 30;

export const AREA_N = 420;
export const AREA_START = 320;
export const AREA_STEP = 6;
export const AREA_VISIBLE = 175;
export const AREA_SMALL_VISIBLE = 80;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type Candle = {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  /** Tick-aligned times (0..1) at which the live path visits h / l. */
  tH: number;
  tL: number;
  n1: number;
  n2: number;
};

export type SignalCell = { at: number[]; labels: SignalLabel[] };

export type VersionData = {
  version: Version;
  candles: Candle[];
  /** Per window-end index: [min, max] of price incl. bands, max volume. */
  rangeLo: number[];
  rangeHi: number[];
  volMax: number[];
  area: number[];
  areaVol: number[];
  areaSmall: number[];
  signals: SignalCell[];
};

// ---------------------------------------------------------------------------
// Indicators (pure functions over arrays)
// ---------------------------------------------------------------------------
export const sma = (a: number[], n: number) => {
  const out = new Array<number>(a.length).fill(NaN);
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i];
    if (i >= n) s -= a[i - n];
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
};

export const stdev = (a: number[], mean: number[], n: number) => {
  const out = new Array<number>(a.length).fill(NaN);
  for (let i = n - 1; i < a.length; i++) {
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += (a[j] - mean[i]) ** 2;
    out[i] = Math.sqrt(s / n);
  }
  return out;
};

export const ema = (a: number[], n: number) => {
  const out = new Array<number>(a.length);
  const k = 2 / (n + 1);
  out[0] = a[0];
  for (let i = 1; i < a.length; i++) out[i] = a[i] * k + out[i - 1] * (1 - k);
  return out;
};

export type Indicators = {
  sma: number[];
  bbU: number[];
  bbL: number[];
  ema: number[];
  stK: number[];
  stD: number[];
  macd: number[];
  sig: number[];
  hist: number[];
  histSig: number[];
};

export const indicators = (c: number[], h: number[], l: number[]): Indicators => {
  const m = sma(c, 20);
  const sd = stdev(c, m, 20);
  const raw = c.map((x, i) => {
    if (i < 8) return 50;
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - 8; j <= i; j++) {
      hh = Math.max(hh, h[j]);
      ll = Math.min(ll, l[j]);
    }
    return hh === ll ? 50 : ((x - ll) / (hh - ll)) * 100;
  });
  const stK = sma(raw, 3);
  const stD = sma(stK.map((x) => (Number.isNaN(x) ? 50 : x)), 3);
  const e26 = ema(c, 26);
  const macd = ema(c, 12).map((x, i) => x - e26[i]);
  const sig = ema(macd, 9);
  const hist = macd.map((x, i) => x - sig[i]);
  return {
    sma: m,
    bbU: m.map((x, i) => x + 2 * sd[i]),
    bbL: m.map((x, i) => x - 2 * sd[i]),
    ema: ema(c, 50),
    stK,
    stD,
    macd,
    sig,
    hist,
    histSig: ema(hist, 5),
  };
};

// ---------------------------------------------------------------------------
// Generation — runs once per version at module load.
// ---------------------------------------------------------------------------
const tickT = (r: () => number, lo: number, hi: number) => {
  // A time in [lo, hi] snapped to a tick so the live wick reaches the
  // candle's final high/low exactly on a sampled tick.
  const steps = (CANDLE_FRAMES - 1) / TICK;
  const s = Math.round((lo + (hi - lo) * r()) * steps);
  return Math.min(steps - 1, Math.max(1, s)) / steps;
};

const genCandles = (v: Version, r: () => number): Candle[] => {
  const out: Candle[] = [];
  let price = v.startPrice;
  const ph = r() * 6.28;
  for (let i = 0; i < N_CANDLES; i++) {
    // Slow waves give the realistic counter-trend bounces / dips.
    const wave = Math.sin(i * 0.23 + ph) * 0.0045 + Math.sin(i * 0.083 + ph * 2) * 0.0025;
    const ret = v.drift + wave + v.vol * gaussian(r);
    const o = price;
    const c = o * Math.exp(ret);
    const h = Math.max(o, c) * (1 + Math.abs(gaussian(r)) * v.vol * 0.45 + 0.0008);
    const l = Math.min(o, c) * (1 - Math.abs(gaussian(r)) * v.vol * 0.45 - 0.0008);
    const withTrend = Math.sign(c - o) === Math.sign(v.drift);
    const vol =
      1.35e6 * (0.55 + (Math.abs(ret) / v.vol) * 0.55 + r() * 0.5) * (withTrend ? 1.3 : 0.8);
    const hFirst = r() < 0.5;
    const t1 = tickT(r, 0.12, 0.42);
    const t2 = tickT(r, 0.55, 0.88);
    out.push({
      o,
      h,
      l,
      c,
      v: vol,
      tH: hFirst ? t1 : t2,
      tL: hFirst ? t2 : t1,
      n1: r() * 6.28,
      n2: r() * 6.28,
    });
    price = c;
  }
  return out;
};

const genArea = (n: number, start: number, drift: number, vol: number, r: () => number) => {
  const out: number[] = [];
  let p = start;
  const ph = r() * 6.28;
  for (let i = 0; i < n; i++) {
    const spike = r() < 0.06 ? gaussian(r) * vol * 3 : 0;
    p *= Math.exp(drift + Math.sin(i * 0.09 + ph) * 0.006 + gaussian(r) * vol + spike);
    out.push(p);
  }
  return out;
};

// The signal grid holds a fixed mix of labels (from the version's weights,
// out of 10 cells). Labels change by swapping two cells now and then, so the
// mix, e.g. "mostly Sell", holds on every frame while the panel stays alive.
const genSignals = (v: Version, r: () => number): SignalCell[] => {
  const entries = Object.entries(v.signalMix) as [SignalLabel, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const deck: SignalLabel[] = [];
  for (const [label, w] of entries) {
    for (let i = 0; i < Math.round((w / total) * 10); i++) deck.push(label);
  }
  while (deck.length > 10) deck.pop();
  while (deck.length < 10) deck.push(entries[0][0]);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const cells: SignalCell[] = deck.map((l) => ({ at: [-1], labels: [l] }));
  const cur = [...deck];
  let t = 30 + Math.floor(r() * 30);
  while (t < DURATION - 15) {
    const a = Math.floor(r() * 10);
    let b = Math.floor(r() * 10);
    for (let n = 0; n < 10 && cur[b] === cur[a]; n++) b = (b + 1) % 10;
    if (cur[a] !== cur[b]) {
      [cur[a], cur[b]] = [cur[b], cur[a]];
      cells[a].at.push(t);
      cells[a].labels.push(cur[a]);
      cells[b].at.push(t + 4);
      cells[b].labels.push(cur[b]);
    }
    t += 38 + Math.floor(r() * 40);
  }
  return cells;
};

export const liveValueAt = (c: Candle, t: number) => {
  // Path through open -> (high|low) -> (low|high) -> close, cosine eased,
  // with a small wobble that vanishes at the key points.
  const keys: [number, number][] = [
    [0, c.o],
    [Math.min(c.tH, c.tL), c.tH < c.tL ? c.h : c.l],
    [Math.max(c.tH, c.tL), c.tH < c.tL ? c.l : c.h],
    [1, c.c],
  ];
  let seg = 0;
  while (seg < 2 && t > keys[seg + 1][0]) seg++;
  const [t0, v0] = keys[seg];
  const [t1, v1] = keys[seg + 1];
  const u = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
  const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
  const wob = Math.sin(Math.PI * u) * (Math.sin(t * 23 + c.n1) * 0.6 + Math.sin(t * 41 + c.n2) * 0.4);
  const x = v0 + (v1 - v0) * e + wob * (c.h - c.l) * 0.12;
  return Math.min(c.h, Math.max(c.l, x));
};

export const build = (v: Version): VersionData => {
  const r = mulberry32(v.seed);
  const candles = genCandles(v, r);
  const ind = indicators(
    candles.map((c) => c.c),
    candles.map((c) => c.h),
    candles.map((c) => c.l),
  );
  const rangeLo: number[] = [];
  const rangeHi: number[] = [];
  const volMax: number[] = [];
  for (let e = 0; e < N_CANDLES; e++) {
    let lo = Infinity;
    let hi = -Infinity;
    let vm = 0;
    for (let i = Math.max(0, e - VISIBLE); i <= Math.min(N_CANDLES - 1, e + 1); i++) {
      lo = Math.min(lo, candles[i].l, Number.isNaN(ind.bbL[i]) ? Infinity : ind.bbL[i]);
      hi = Math.max(hi, candles[i].h, Number.isNaN(ind.bbU[i]) ? -Infinity : ind.bbU[i]);
      vm = Math.max(vm, candles[i].v);
    }
    const pad = (hi - lo) * 0.06;
    rangeLo.push(lo - pad);
    rangeHi.push(hi + pad);
    volMax.push(vm);
  }
  const area = genArea(AREA_N, v.startPrice * 0.4, v.areaDrift, 0.017, r);
  const areaVol = area.map(() => 0.25 + r() * 0.75);
  const areaSmall = genArea(AREA_N, 80, v.areaSmallDrift, 0.02, r);
  return {
    version: v,
    candles,
    rangeLo,
    rangeHi,
    volMax,
    area,
    areaVol,
    areaSmall,
    signals: genSignals(v, r),
  };
};

export const DATA: Record<string, VersionData> = Object.fromEntries(
  Object.values(VERSIONS).map((v) => [v.id, build(v)]),
);
