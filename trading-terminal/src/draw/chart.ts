import {
  CANDLE_FRAMES,
  Clock,
  Series,
  Window,
  lastValues,
  priceRange,
  windowAt,
} from "../engine/data";
import { clamp } from "../engine/random";
import { alpha, C } from "../theme";
import { hline, niceStep, Painter, Pt, Rect, strokePath, tag, text, vline } from "./primitives";

// ---------------------------------------------------------------------------
// Shared x-axis: every panel under the main chart uses the same candle slots.

export interface XMap {
  slot: number;
  win: Window;
  live: number;
  x0: number;
  x1: number;
  xOf: (seriesIndex: number) => number;
}

export const makeXMap = (
  s: Series,
  clock: Clock,
  x0: number,
  x1: number,
  count: number,
  rightPad = 1.6,
): XMap => {
  const slot = (x1 - x0) / (count + rightPad - 0.5);
  const win = windowAt(s, clock.tick, count + 3);
  const xLive = x1 - slot * rightPad;
  return {
    slot,
    win,
    live: clock.live,
    x0,
    x1,
    xOf: (i) => xLive - (clock.live - i) * slot + clock.scroll * slot,
  };
};

// ---------------------------------------------------------------------------
// Rolling value tags update every 6 frames and roll over 4 frames.

export const TAG_FRAMES = 6;
export const tagClock = (s: Series, clock: Clock) => {
  const e = Math.floor(clock.g / TAG_FRAMES);
  const ticksPer = TAG_FRAMES / (CANDLE_FRAMES / 15);
  const next = lastValues(s, Math.max(0, e * ticksPer));
  const prev = lastValues(s, Math.max(0, (e - 1) * ticksPer));
  return { prev, next, prog: clamp((clock.g - e * TAG_FRAMES) / 4) };
};

export const fmt = (v: number, d: number) => v.toFixed(d);

// ---------------------------------------------------------------------------

export interface CandleChartOpts {
  count: number;
  axisW: number;
  volFrac: number;
  fs: number;
  decimals: number;
  gridRows: number;
  band?: boolean;
  timeAxis?: boolean;
  bodyFrac?: number;
  tags?: boolean;
  lineScale?: number;
  /** Draw a thin trend line through the visible window. */
  trendLine?: boolean;
  /** Candles (from the right) that set the price range; default = count. */
  rangeCount?: number;
  /** Keep this price at the vertical centre of the price area. */
  centrePrice?: number;
  /** Shift the price axis so `price` lands exactly at screen y `y`. */
  anchor?: { price: number; y: number };
  /** Moving-average lines and their tags (default true). */
  ma?: boolean;
  /** Strength of the white core added to candles in the bloom pass. */
  hotCore?: number;
}

export interface ChartGeom {
  xmap: XMap;
  yOf: (price: number) => number;
  plot: Rect;
  range: readonly [number, number];
}

export const drawCandleChart = (
  p: Painter,
  s: Series,
  clock: Clock,
  r: Rect,
  o: CandleChartOpts,
): ChartGeom => {
  const { ctx } = p;
  const timeH = o.timeAxis ? o.fs * 2.1 : 0;
  const plot: Rect = { x: r.x, y: r.y, w: r.w - o.axisW, h: r.h - timeH };
  const priceH = plot.h * (1 - o.volFrac);
  const xmap = makeXMap(s, clock, plot.x, plot.x + plot.w, o.count);
  let range = priceRange(s, clock, o.rangeCount ?? o.count + 1, 0.1);
  if (o.centrePrice !== undefined) {
    const c = o.centrePrice;
    const half = Math.max(c - range[0], range[1] - c);
    range = [c - half, c + half] as const;
  }
  if (o.anchor) {
    const sc = (priceH * 0.92) / (range[1] - range[0]);
    const yNow = plot.y + priceH * 0.04 + (1 - (o.anchor.price - range[0]) / (range[1] - range[0])) * priceH * 0.92;
    const dp = (yNow - o.anchor.y) / sc;
    range = [range[0] - dp, range[1] - dp] as const;
  }
  const yOf = (v: number) =>
    plot.y + priceH * 0.04 + (1 - (v - range[0]) / (range[1] - range[0])) * priceH * 0.92;
  const { win, slot } = xmap;
  const ls = o.lineScale ?? 1;

  // Grid
  const step = niceStep(range[1] - range[0], o.gridRows);
  for (let v = Math.ceil(range[0] / step) * step; v < range[1]; v += step) {
    const y = yOf(v);
    if (y < plot.y + 4 || y > plot.y + priceH - 4) continue;
    hline(p, plot.x, plot.x + plot.w, y, C.grid, 1.5);
    text(p, fmt(v, o.decimals), plot.x + plot.w + o.fs * 0.6, y, o.fs * 0.82, o.ma === false ? C.textBright : C.textDim, {
      mono: true,
      weight: o.ma === false ? 600 : 500,
    });
  }
  for (let i = win.start; i <= xmap.live + 1; i++) {
    if (i % 8 !== 0) continue;
    const x = xmap.xOf(i);
    if (x < plot.x || x > plot.x + plot.w) continue;
    vline(p, x, plot.y, plot.y + plot.h, C.grid, 1.5);
    if (o.timeAxis) {
      const hh = String((i * 1) % 24).padStart(2, "0");
      text(p, `${hh}:00`, x, plot.y + plot.h + timeH * 0.5, o.fs * 0.78, C.textDim, {
        mono: true,
        align: "center",
      });
    }
  }
  if (!p.glow) {
    ctx.save();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plot.x + plot.w, r.y);
    ctx.lineTo(plot.x + plot.w, r.y + r.h);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.x, plot.y, plot.w, plot.h);
  ctx.clip();

  const idx = (j: number) => win.start + j;
  const ptsOf = (arr: number[]): Pt[] => arr.map((v, j) => [xmap.xOf(idx(j)), yOf(v)]);

  // Band
  if (o.band) {
    const up = ptsOf(win.bandUp);
    const lo = ptsOf(win.bandLo);
    if (!p.glow) {
      ctx.save();
      ctx.beginPath();
      up.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let j = lo.length - 1; j >= 0; j--) ctx.lineTo(lo[j][0], lo[j][1]);
      ctx.closePath();
      ctx.fillStyle = alpha(C.blue, 0.1);
      ctx.fill();
      ctx.restore();
    }
    strokePath(p, up, alpha(C.blue, 0.75), 2 * ls, { glow: 0.25 });
    strokePath(p, lo, alpha(C.blue, 0.75), 2 * ls, { glow: 0.25 });
  }

  // Volume
  const volTop = plot.y + priceH;
  const volH = plot.h - priceH;
  let vmax = 0;
  for (const c of win.candles) vmax = Math.max(vmax, c.v);
  const bodyW = slot * (o.bodyFrac ?? 0.62);
  win.candles.forEach((c, j) => {
    const x = xmap.xOf(idx(j));
    const up = c.c >= c.o;
    const h = (c.v / vmax) * volH * 0.9;
    ctx.fillStyle = alpha(up ? C.green : C.red, p.glow ? 0.12 : 0.38);
    ctx.fillRect(x - bodyW / 2, volTop + volH - h, bodyW, h);
  });

  // Moving averages
  if (o.ma !== false) {
    strokePath(p, ptsOf(win.sma), C.orange, 3.2 * ls, { glow: 1 });
    strokePath(p, ptsOf(win.ema), C.blue, 3.2 * ls, { glow: 1 });
  }

  // Candles
  const wickW = Math.max(1.6, slot * 0.1);
  win.candles.forEach((c, j) => {
    const i = idx(j);
    const x = xmap.xOf(i);
    if (x < plot.x - slot || x > plot.x + plot.w + slot) return;
    const up = c.c >= c.o;
    const col = up ? C.green : C.red;
    const yo = yOf(c.o);
    const yc = yOf(c.c);
    ctx.fillStyle = col;
    ctx.globalAlpha = p.glow ? 0.85 : 1;
    ctx.fillRect(x - wickW / 2, yOf(c.h), wickW, Math.max(1, yOf(c.l) - yOf(c.h)));
    const top = Math.min(yo, yc);
    const bh = Math.max(2, Math.abs(yc - yo));
    ctx.fillRect(x - bodyW / 2, top, bodyW, bh);
    if (p.glow) {
      // Hot core: the bloom pass adds a little white so bright candles
      // read as slightly over-exposed, like a photographed monitor.
      ctx.fillStyle = "#FFFFFF";
      ctx.globalAlpha = o.hotCore ?? 0.3;
      ctx.fillRect(x - bodyW * 0.25, top, bodyW * 0.5, bh);
    }
    ctx.globalAlpha = 1;
  });

  if (o.trendLine) {
    const a = win.candles[0];
    const b = win.candles[win.candles.length - 1];
    strokePath(
      p,
      [
        [xmap.xOf(win.start), yOf((a.h + a.l) / 2)],
        [xmap.xOf(xmap.live) + slot * 3, yOf((b.h + b.l) / 2)],
      ],
      alpha(C.textBright, 0.4),
      1.6 * ls,
      { glow: 0 },
    );
  }

  // Live price line
  const liveC = win.candles[win.candles.length - 1];
  const liveCol = liveC.c >= liveC.o ? C.green : C.red;
  hline(p, plot.x, plot.x + plot.w, yOf(liveC.c), alpha(liveCol, 0.55), 2.5);
  ctx.restore();

  // Axis tags
  if (o.tags !== false) {
    const tc = tagClock(s, clock);
    const items = [
      ...(o.ma === false
        ? []
        : [
            { v: tc.next.sma, pv: tc.prev.sma, col: C.orange },
            { v: tc.next.ema, pv: tc.prev.ema, col: C.blue },
          ]),
      {
        v: tc.next.price,
        pv: tc.prev.price,
        col: tc.next.price >= tc.next.open ? C.green : C.red,
      },
    ];
    // Keep tags from overlapping (current price wins its spot).
    const th = o.fs * 1.5;
    const ys = items.map((it) => yOf(it.v));
    const order = items.map((_, k) => items.length - 1 - k);
    const placed: number[] = [];
    for (const k of order) {
      let y = ys[k];
      for (const py of placed) {
        if (Math.abs(y - py) < th) y = y < py ? py - th : py + th;
      }
      ys[k] = y;
      placed.push(y);
    }
    items.forEach((it, k) =>
      tag(p, {
        x: plot.x + plot.w + o.fs * 0.3,
        y: ys[k],
        prev: fmt(it.pv, o.decimals),
        next: fmt(it.v, o.decimals),
        prog: tc.prog,
        up: it.v >= it.pv,
        color: it.col,
        size: o.fs,
        filled: true,
      }),
    );
  }
  return { xmap, yOf, plot, range };
};

// ---------------------------------------------------------------------------
// Oscillator (RSI 9 and its 3-period signal, 0..100)

export const drawOscillator = (
  p: Painter,
  s: Series,
  clock: Clock,
  r: Rect,
  xmap: XMap,
  o: {
    axisW: number;
    fs: number;
    title?: string;
    lineScale?: number;
    bandAlpha?: number;
    /** Visible value range (default 0..100). */
    lo?: number;
    hi?: number;
    levels?: [number, number];
  },
) => {
  const { ctx } = p;
  const plot: Rect = { x: r.x, y: r.y, w: r.w - o.axisW, h: r.h };
  const lo = o.lo ?? 0;
  const hi = o.hi ?? 100;
  const [L1, L2] = o.levels ?? [30, 70];
  const yOf = (v: number) => plot.y + plot.h * 0.06 + (1 - (v - lo) / (hi - lo)) * plot.h * 0.88;
  const ls = o.lineScale ?? 1;
  if (!p.glow) {
    ctx.save();
    ctx.fillStyle = alpha(C.blue, o.bandAlpha ?? 0.1);
    ctx.fillRect(plot.x, yOf(L2), plot.w, yOf(L1) - yOf(L2));
    ctx.restore();
  }
  hline(p, plot.x, plot.x + plot.w, yOf(L2), alpha(C.textBright, 0.8), 2.5 * (o.lineScale ?? 1), [14 * (o.lineScale ?? 1), 12 * (o.lineScale ?? 1)]);
  hline(p, plot.x, plot.x + plot.w, yOf(L1), alpha(C.textBright, 0.8), 2.5 * (o.lineScale ?? 1), [14 * (o.lineScale ?? 1), 12 * (o.lineScale ?? 1)]);
  hline(p, plot.x, plot.x + plot.w, yOf(50), C.grid, 1.5, [4, 8]);
  for (const lv of [L1, 50, L2]) {
    text(p, `${lv}.00`, plot.x + plot.w + o.fs * 0.6, yOf(lv), o.fs * 0.82, C.textDim, {
      mono: true,
    });
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.x, plot.y, plot.w, plot.h);
  ctx.clip();
  const { win } = xmap;
  const pts = (a: number[]): Pt[] => a.map((v, j) => [xmap.xOf(win.start + j), yOf(v)]);
  strokePath(p, pts(win.rsiSig), C.orange, 3.4 * ls);
  strokePath(p, pts(win.rsi), C.blue, 3.4 * ls);
  ctx.restore();
  if (o.title) text(p, o.title, plot.x + o.fs * 0.8, plot.y + o.fs * 1.1, o.fs * 0.9, C.textDim);
  const tc = tagClock(s, clock);
  const ky = yOf(tc.next.rsi);
  let dy = yOf(tc.next.rsiSig);
  if (Math.abs(dy - ky) < o.fs * 1.5) dy = dy < ky ? ky - o.fs * 1.5 : ky + o.fs * 1.5;
  tag(p, {
    x: plot.x + plot.w + o.fs * 0.3,
    y: dy,
    prev: fmt(tc.prev.rsiSig, 2),
    next: fmt(tc.next.rsiSig, 2),
    prog: tc.prog,
    color: C.orange,
    size: o.fs,
    filled: true,
    minChars: 5,
  });
  tag(p, {
    x: plot.x + plot.w + o.fs * 0.3,
    y: ky,
    prev: fmt(tc.prev.rsi, 2),
    next: fmt(tc.next.rsi, 2),
    prog: tc.prog,
    color: C.blue,
    size: o.fs,
    filled: true,
    minChars: 5,
  });
  return { yOf };
};

// ---------------------------------------------------------------------------
// Histogram (MACD histogram + signal line), zero-crossing, gradient fill

export const drawHistogram = (
  p: Painter,
  s: Series,
  clock: Clock,
  r: Rect,
  xmap: XMap,
  o: { axisW: number; fs: number; title?: string; decimals?: number; lineScale?: number },
) => {
  const { ctx } = p;
  const plot: Rect = { x: r.x, y: r.y, w: r.w - o.axisW, h: r.h };
  const { win } = xmap;
  let m = 1e-9;
  for (let j = 0; j < win.hist.length; j++) {
    m = Math.max(m, Math.abs(win.hist[j]), Math.abs(win.signal[j]) * 0.6);
  }
  const zero = plot.y + plot.h / 2;
  const sc = (plot.h * 0.42) / m;
  const yOf = (v: number) => zero - v * sc;
  const ls = o.lineScale ?? 1;
  hline(p, plot.x, plot.x + plot.w, zero, C.gridStrong, 1.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.x, plot.y, plot.w, plot.h);
  ctx.clip();
  const gUp = ctx.createLinearGradient(0, zero - plot.h * 0.45, 0, zero);
  gUp.addColorStop(0, alpha(C.green, p.glow ? 0.6 : 0.95));
  gUp.addColorStop(1, alpha(C.green, 0.12));
  const gDn = ctx.createLinearGradient(0, zero, 0, zero + plot.h * 0.45);
  gDn.addColorStop(0, alpha(C.red, 0.12));
  gDn.addColorStop(1, alpha(C.red, p.glow ? 0.6 : 0.95));
  const bw = xmap.slot * 0.72;
  win.hist.forEach((v, j) => {
    const x = xmap.xOf(win.start + j);
    ctx.fillStyle = v >= 0 ? gUp : gDn;
    const y = yOf(v);
    ctx.fillRect(x - bw / 2, Math.min(y, zero), bw, Math.abs(y - zero));
  });
  const pts = win.signal.map((v, j): Pt => [xmap.xOf(win.start + j), yOf(v * 0.6)]);
  strokePath(p, pts, C.orange, 3 * ls);
  ctx.restore();
  if (o.title) text(p, o.title, plot.x + o.fs * 0.8, plot.y + o.fs * 1.1, o.fs * 0.9, C.textDim);
  const tc = tagClock(s, clock);
  const d = o.decimals ?? 2;
  tag(p, {
    x: plot.x + plot.w + o.fs * 0.3,
    y: zero - o.fs * 0.8,
    prev: fmt(tc.prev.hist, d),
    next: fmt(tc.next.hist, d),
    prog: tc.prog,
    color: tc.next.hist >= 0 ? C.green : C.red,
    size: o.fs,
    filled: true,
    minChars: 6,
  });
  tag(p, {
    x: plot.x + plot.w + o.fs * 0.3,
    y: zero + o.fs * 0.8,
    prev: fmt(tc.prev.signal * 0.6, d),
    next: fmt(tc.next.signal * 0.6, d),
    prog: tc.prog,
    color: C.orange,
    size: o.fs,
    filled: true,
    minChars: 6,
  });
  return { yOf, zero };
};
