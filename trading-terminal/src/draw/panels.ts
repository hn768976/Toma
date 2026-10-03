import { Clock, Series } from "../engine/data";
import { clamp, easeOutCubic, hash01 } from "../engine/random";
import { Rating, Version } from "../engine/versions";
import { alpha, C } from "../theme";
import { fmt, TAG_FRAMES, tagClock } from "./chart";
import { hline, Painter, Pt, Rect, rollText, roundRect, strokePath, tag, text, vline } from "./primitives";

// ---------------------------------------------------------------------------
// Toolbar (generic labels only)

export const drawToolbar = (p: Painter, clock: Clock, r: Rect, fs: number) => {
  if (p.glow) return;
  const { ctx } = p;
  ctx.save();
  ctx.fillStyle = C.bgDeep;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  hline(p, r.x, r.x + r.w, r.y + r.h, C.line, 2);
  const cy = r.y + r.h / 2;
  let x = r.x + fs * 1.2;
  for (const lbl of ["1m", "5m", "15m", "1H", "4H", "1D", "1W"]) {
    const on = lbl === "1H";
    if (on) {
      ctx.save();
      roundRect(ctx, x - fs * 0.45, cy - fs * 0.8, fs * 2.5, fs * 1.6, fs * 0.25);
      ctx.fillStyle = alpha(C.blue, 0.22);
      ctx.fill();
      ctx.restore();
    }
    text(p, lbl, x, cy, fs, on ? C.textBright : C.textDim, { weight: on ? 600 : 500 });
    x += fs * 3.2;
  }
  vline(p, x, r.y + r.h * 0.25, r.y + r.h * 0.75, C.line, 2);
  x += fs * 1.2;
  for (const lbl of ["Candles", "Indicators", "Compare", "Alerts", "Replay"]) {
    text(p, lbl, x, cy, fs, C.text);
    ctx.save();
    ctx.font = `500 ${fs}px "Inter"`;
    x += ctx.measureText(lbl).width + fs * 2;
    ctx.restore();
  }
  const sec = Math.floor(clock.g / 30) + 7;
  const t = `14:${String(31 + Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  text(p, t, r.x + r.w - fs * 1.2, cy, fs, C.text, { mono: true, align: "right" });
  ctx.save();
  ctx.fillStyle = C.green;
  ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(clock.g * 0.11));
  ctx.beginPath();
  ctx.arc(r.x + r.w - fs * 7.4, cy, fs * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  text(p, "LIVE", r.x + r.w - fs * 6.8, cy, fs * 0.8, C.green, { weight: 700 });
};

// ---------------------------------------------------------------------------
// Area chart: jagged line with a darker gradient fill

export const AREA_STEP = 5;
const AREA_BASE = 130;

export const drawAreaChart = (
  p: Painter,
  values: number[],
  clock: Clock,
  r: Rect,
  color: string,
  o: { fs: number; title: string; points: number; lineScale?: number },
) => {
  const { ctx } = p;
  const q = Math.floor(clock.g / AREA_STEP);
  const frac = (clock.g - q * AREA_STEP) / AREA_STEP;
  const last = AREA_BASE + q;
  // Fixed range over everything the clip will show.
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = AREA_BASE - o.points; i <= AREA_BASE + 96; i++) {
    lo = Math.min(lo, values[i]);
    hi = Math.max(hi, values[i]);
  }
  const head = o.fs * 2.6;
  const plot: Rect = { x: r.x, y: r.y + head, w: r.w, h: r.h - head };
  const pad = (hi - lo) * 0.12;
  const yOf = (v: number) =>
    plot.y + plot.h * 0.06 + (1 - (v - lo + pad) / (hi - lo + 2 * pad)) * plot.h * 0.9;
  const dx = plot.w / (o.points - 1);
  const pts: Pt[] = [];
  for (let k = o.points; k >= 0; k--) {
    const i = last - k;
    pts.push([plot.x + plot.w - (k - frac + 1) * dx, yOf(values[i])]);
  }
  // Live point slides toward the next sample.
  const lv = values[last] + (values[last + 1] - values[last]) * easeOutCubic(frac);
  pts.push([plot.x + plot.w - dx * (1 - frac) * 0.0 - dx * 0.2, yOf(lv)]);
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.x, plot.y, plot.w, plot.h);
  ctx.clip();
  if (!p.glow) {
    for (let k = 1; k < 4; k++) hline(p, plot.x, plot.x + plot.w, plot.y + (plot.h * k) / 4, C.grid, 1.5);
    const g = ctx.createLinearGradient(0, plot.y, 0, plot.y + plot.h);
    g.addColorStop(0, alpha(color, 0.5));
    g.addColorStop(1, alpha(color, 0.05));
    ctx.beginPath();
    ctx.moveTo(pts[0][0], plot.y + plot.h);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(pts[pts.length - 1][0], plot.y + plot.h);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  }
  strokePath(p, pts, color, 3 * (o.lineScale ?? 1));
  ctx.restore();
  text(p, o.title, r.x + o.fs * 0.2, r.y + head * 0.45, o.fs * 0.95, C.textDim);
  const prevV = values[last - 1];
  const chg = ((lv - values[AREA_BASE - o.points]) / Math.abs(values[AREA_BASE - o.points])) * 100;
  const ep = Math.floor(clock.g / TAG_FRAMES);
  const pv = values[AREA_BASE + Math.floor(((ep - 1) * TAG_FRAMES) / AREA_STEP)];
  const nv = values[AREA_BASE + Math.floor((ep * TAG_FRAMES) / AREA_STEP)];
  tag(p, {
    x: r.x + r.w,
    y: r.y + head * 0.45,
    prev: fmt(pv * 1000, 1),
    next: fmt(nv * 1000, 1),
    prog: clamp((clock.g - ep * TAG_FRAMES) / 4),
    up: nv >= pv,
    color,
    size: o.fs,
    filled: true,
    align: "right",
  });
  text(p, `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`, r.x + r.w - o.fs * 7.4, r.y + head * 0.45, o.fs * 0.9, color, {
    mono: true,
    align: "right",
  });
  void prevV;
};

// ---------------------------------------------------------------------------
// Signal / ratings panel

const OSC_NAMES = [
  "RSI (14)",
  "Stoch (14, 3, 3)",
  "CCI (20)",
  "ADX (14)",
  "Momentum (10)",
  "MACD (12, 26)",
  "Williams %R",
  "Ultimate Osc",
  "Awesome Osc",
  "Bull/Bear power",
];
const MA_NAMES = [
  "EMA (10)",
  "SMA (10)",
  "EMA (20)",
  "SMA (20)",
  "EMA (50)",
  "SMA (50)",
  "EMA (100)",
  "SMA (100)",
  "VWMA (20)",
  "Hull MA (9)",
];
const RATINGS: Rating[] = ["Strong buy", "Buy", "Neutral", "Sell"];
const ratingColor = (r: Rating) =>
  r === "Sell" ? C.red : r === "Neutral" ? C.grey : C.green;
const ratingScore = (r: Rating) =>
  r === "Strong buy" ? 1 : r === "Buy" ? 0.5 : r === "Neutral" ? 0 : -0.8;

const pick = (u: number, mix: Record<Rating, number>): Rating => {
  let tot = 0;
  for (const r of RATINGS) tot += mix[r];
  let acc = 0;
  for (const r of RATINGS) {
    acc += mix[r] / tot;
    if (u < acc) return r;
  }
  return "Neutral";
};

/** Rating of row j at market frame g, plus how recently it changed. */
export const ratingAt = (v: Version, j: number, g: number) => {
  const period = 75 + Math.floor(hash01(v.seed, j, 1) * 150);
  const phase = Math.floor(hash01(v.seed, j, 2) * period);
  const local = g + phase;
  const e = Math.floor(local / period);
  const cur = pick(hash01(v.seed * 31 + j, e, 7), v.signalMix);
  const prev = pick(hash01(v.seed * 31 + j, e - 1, 7), v.signalMix);
  const since = local - e * period;
  return { cur, prev, flash: cur !== prev ? clamp(1 - since / 14) : 0, since };
};

const drawIcon = (p: Painter, r: Rating, x: number, y: number, s: number) => {
  const { ctx } = p;
  const col = ratingColor(r);
  ctx.save();
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.globalAlpha = p.glow ? 0.6 : 1;
  const tri = (cx: number, cy: number, up: boolean) => {
    ctx.beginPath();
    if (up) {
      ctx.moveTo(cx, cy - s * 0.42);
      ctx.lineTo(cx + s * 0.38, cy + s * 0.12);
      ctx.lineTo(cx - s * 0.38, cy + s * 0.12);
    } else {
      ctx.moveTo(cx, cy + s * 0.42);
      ctx.lineTo(cx + s * 0.38, cy - s * 0.12);
      ctx.lineTo(cx - s * 0.38, cy - s * 0.12);
    }
    ctx.closePath();
    ctx.fill();
  };
  if (r === "Strong buy") {
    tri(x, y - s * 0.2, true);
    tri(x, y + s * 0.28, true);
  } else if (r === "Buy") {
    tri(x, y - s * 0.05, true);
    ctx.fillRect(x - s * 0.1, y + s * 0.05, s * 0.2, s * 0.38);
  } else if (r === "Sell") {
    tri(x, y + s * 0.05, false);
    ctx.fillRect(x - s * 0.1, y - s * 0.43, s * 0.2, s * 0.38);
  } else {
    ctx.lineWidth = s * 0.14;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(x - s * 0.18, y - s * 0.06, s * 0.36, s * 0.12);
  }
  ctx.restore();
};

export const drawSignalPanel = (
  p: Painter,
  v: Version,
  clock: Clock,
  r: Rect,
  fs: number,
) => {
  const { ctx } = p;
  const g = clock.g;
  // Summary gauge – score averaged over the last 12 frames so the needle eases.
  const scoreAt = (gg: number) => {
    let sc = 0;
    for (let j = 0; j < 20; j++) sc += ratingScore(ratingAt(v, j, gg).cur);
    return sc / 20;
  };
  let score = 0;
  for (let k = 0; k < 12; k++) score += scoreAt(g - k);
  score /= 12;
  const counts: Record<Rating, number> = { "Strong buy": 0, Buy: 0, Neutral: 0, Sell: 0 };
  for (let j = 0; j < 20; j++) counts[ratingAt(v, j, g).cur]++;

  const headH = r.h * 0.3;
  text(p, "Technical ratings", r.x + fs, r.y + fs * 1.4, fs * 1.05, C.text, { weight: 600 });
  text(p, "Summary", r.x + fs, r.y + fs * 3.1, fs * 0.85, C.textDim);
  const summary: Rating =
    score > 0.5 ? "Strong buy" : score > 0.15 ? "Buy" : score > -0.12 ? "Neutral" : "Sell";
  text(p, summary, r.x + fs, r.y + fs * 4.9, fs * 1.9, ratingColor(summary), {
    weight: 700,
    glow: true,
  });
  // Gauge
  const gx = r.x + r.w * 0.68;
  const gy = r.y + headH * 0.86;
  const gr = Math.min(r.w * 0.24, headH * 0.66);
  const segs = [C.red, alpha(C.red, 0.55), C.grey, alpha(C.green, 0.55), C.green];
  segs.forEach((col, k) => {
    const a0 = Math.PI + (k / 5) * Math.PI + 0.03;
    const a1 = Math.PI + ((k + 1) / 5) * Math.PI - 0.03;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.globalAlpha = p.glow ? 0.35 : 0.9;
    ctx.lineWidth = gr * 0.13;
    ctx.beginPath();
    ctx.arc(gx, gy, gr, a0, a1);
    ctx.stroke();
    ctx.restore();
  });
  const na = Math.PI + ((clamp(score, -1, 1) + 1) / 2) * Math.PI;
  strokePath(p, [[gx, gy], [gx + Math.cos(na) * gr * 0.86, gy + Math.sin(na) * gr * 0.86]], C.textBright, gr * 0.05, { glow: 0.5 });
  if (!p.glow) {
    ctx.save();
    ctx.fillStyle = C.textBright;
    ctx.beginPath();
    ctx.arc(gx, gy, gr * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  text(p, "Sell", gx - gr * 1.05, gy + fs * 1.1, fs * 0.8, C.red, { align: "center" });
  text(p, "Buy", gx + gr * 1.05, gy + fs * 1.1, fs * 0.8, C.green, { align: "center" });
  text(p, "Neutral", gx, gy - gr - fs * 0.9, fs * 0.8, C.grey, { align: "center" });
  // Counts
  const cy = r.y + headH + fs * 0.4;
  const cw = r.w / 4;
  (["Sell", "Neutral", "Buy", "Strong buy"] as Rating[]).forEach((k, i) => {
    text(p, k, r.x + fs + i * cw, cy, fs * 0.8, C.textDim);
    text(p, String(counts[k]), r.x + fs + i * cw, cy + fs * 1.4, fs * 1.2, ratingColor(k), {
      mono: true,
      weight: 600,
    });
  });
  hline(p, r.x, r.x + r.w, cy + fs * 2.6, C.line, 2);

  // Two columns of rows
  const top = cy + fs * 3.1;
  const colW = r.w / 2;
  const rowH = (r.y + r.h - top - fs * 2.2) / 10;
  [["Oscillators", OSC_NAMES], ["Moving averages", MA_NAMES]].forEach(([title, names], ci) => {
    const x = r.x + ci * colW;
    text(p, title as string, x + fs, top + fs * 0.7, fs * 0.9, C.text, { weight: 600 });
    if (ci === 1) vline(p, x, top, r.y + r.h - fs * 0.5, C.line, 2);
    (names as string[]).forEach((name, i) => {
      const j = ci * 10 + i;
      const y = top + fs * 2.2 + i * rowH + rowH / 2;
      const rt = ratingAt(v, j, g);
      if (rt.flash > 0 && !p.glow) {
        ctx.save();
        ctx.fillStyle = alpha(ratingColor(rt.cur), 0.22 * rt.flash);
        ctx.fillRect(x + 4, y - rowH * 0.46, colW - 8, rowH * 0.92);
        ctx.restore();
      }
      if (rt.flash > 0 && p.glow) {
        ctx.save();
        ctx.fillStyle = alpha(ratingColor(rt.cur), 0.5 * rt.flash);
        ctx.fillRect(x + 4, y - rowH * 0.46, colW - 8, rowH * 0.92);
        ctx.restore();
      }
      text(p, name, x + fs, y, fs * 0.85, C.text);
      const val = (hash01(v.seed, j, 40) - 0.3) * 120 + (hash01(v.seed, j, Math.floor(g / 9)) - 0.5) * 2;
      text(p, val.toFixed(2), x + colW * 0.6, y, fs * 0.82, C.textDim, { mono: true, align: "right" });
      drawIcon(p, rt.cur, x + colW * 0.67, y, fs * 0.95);
      // Label crossfade when it switches
      const e = easeOutCubic(clamp(rt.since / 8));
      const lx = x + colW * 0.67 + fs * 0.9;
      if (rt.cur !== rt.prev && e < 1) {
        text(p, rt.prev, lx, y - e * fs * 0.6, fs * 0.9, ratingColor(rt.prev), { weight: 600, alpha: 1 - e });
        text(p, rt.cur, lx, y + (1 - e) * fs * 0.6, fs * 0.9, ratingColor(rt.cur), { weight: 600, alpha: e, glow: true });
      } else {
        text(p, rt.cur, lx, y, fs * 0.9, ratingColor(rt.cur), {
          weight: rt.cur === "Strong buy" ? 700 : 600,
          glow: true,
        });
      }
    });
  });
};

// ---------------------------------------------------------------------------
// Stats strip: boxes with a label, a rolling value and a mini sparkline

export const drawStatsStrip = (
  p: Painter,
  s: Series,
  clock: Clock,
  r: Rect,
  fs: number,
  decimals: number,
) => {
  const tc = tagClock(s, clock);
  const day = s.candles.slice(clock.live - 24, clock.live + 1);
  const hi = Math.max(...day.map((c) => c.h));
  const lo = Math.min(...day.map((c) => c.l));
  const open = day[0].o;
  const chg = (x: number) => ((x - open) / open) * 100;
  const volSum = (x: { vol: number }) => day.reduce((a, c) => a + c.v, 0) * 1180 + x.vol * 900;
  const items: { label: string; prev: string; next: string; color: string; up: boolean }[] = [
    { label: "Last", prev: fmt(tc.prev.price, decimals), next: fmt(tc.next.price, decimals), color: tc.next.price >= tc.next.open ? C.green : C.red, up: tc.next.price >= tc.prev.price },
    { label: "Change", prev: `${chg(tc.prev.price).toFixed(2)}%`, next: `${chg(tc.next.price).toFixed(2)}%`, color: chg(tc.next.price) >= 0 ? C.green : C.red, up: tc.next.price >= tc.prev.price },
    { label: "24h high", prev: fmt(hi, decimals), next: fmt(hi, decimals), color: C.text, up: true },
    { label: "24h low", prev: fmt(lo, decimals), next: fmt(lo, decimals), color: C.text, up: true },
    { label: "Volume", prev: volSum(tc.prev).toFixed(0), next: volSum(tc.next).toFixed(0), color: C.text, up: true },
    { label: "VWAP", prev: fmt(tc.prev.ema, decimals), next: fmt(tc.next.ema, decimals), color: C.blue, up: tc.next.ema >= tc.prev.ema },
    { label: "MA 50", prev: fmt(tc.prev.sma, decimals), next: fmt(tc.next.sma, decimals), color: C.orange, up: tc.next.sma >= tc.prev.sma },
    { label: "Stoch", prev: tc.prev.k.toFixed(2), next: tc.next.k.toFixed(2), color: C.blue, up: tc.next.k >= tc.prev.k },
  ];
  const bw = r.w / items.length;
  items.forEach((it, i) => {
    const x = r.x + i * bw;
    if (i > 0) vline(p, x, r.y + r.h * 0.12, r.y + r.h * 0.88, C.line, 2);
    text(p, it.label, x + fs * 0.8, r.y + r.h * 0.24, fs * 0.82, C.textDim);
    rollText(p, it.prev, it.next, tc.prog, x + fs * 0.8, r.y + r.h * 0.52, fs * 1.25, it.color, { up: it.up });
    // Sparkline of closes
    const n = 30;
    const vals: number[] = [];
    for (let k = n - 1; k >= 0; k--) vals.push(s.candles[clock.live - k - (i * 3) % 7].c);
    vals[vals.length - 1] = tc.next.price;
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const pts: Pt[] = vals.map((v, k) => [
      x + fs * 0.8 + (k / (n - 1)) * (bw - fs * 1.6),
      r.y + r.h * 0.92 - ((v - mn) / (mx - mn || 1)) * r.h * 0.16,
    ]);
    strokePath(p, pts, alpha(vals[n - 1] >= vals[0] ? C.green : C.red, 0.85), 2.4, { glow: 0.5 });
  });
};

// ---------------------------------------------------------------------------
// Open orders table (generic filler for the lower edge of the screen)

export const drawOrdersTable = (p: Painter, v: Version, s: Series, clock: Clock, r: Rect, fs: number) => {
  const cols = ["Side", "Type", "Qty", "Price", "Filled", "Status"];
  const cw = r.w / cols.length;
  cols.forEach((c, i) => text(p, c, r.x + fs + i * cw, r.y + fs * 1.2, fs * 0.8, C.textDim));
  hline(p, r.x, r.x + r.w, r.y + fs * 2.2, C.line, 2);
  const price = s.candles[clock.live].ticks[clock.k];
  for (let k = 0; k < 6; k++) {
    const y = r.y + fs * 3.4 + k * fs * 1.9;
    if (y > r.y + r.h - fs) break;
    const buy = hash01(v.seed, k, 60) > (v.drift < 0 ? 0.65 : 0.35);
    const col = buy ? C.green : C.red;
    const qty = (0.2 + hash01(v.seed, k, 61) * 4).toFixed(3);
    const pr = price * (1 + (buy ? -1 : 1) * (0.002 + hash01(v.seed, k, 62) * 0.02));
    const fill = Math.min(100, Math.floor(hash01(v.seed, k, 63) * 100 + clock.g * 0.04 * (k + 1)));
    const cells = [buy ? "Buy" : "Sell", k % 2 ? "Limit" : "Stop", qty, pr.toFixed(2), `${fill}%`, fill >= 100 ? "Filled" : "Working"];
    cells.forEach((c, i) =>
      text(p, c, r.x + fs + i * cw, y, fs * 0.85, i === 0 ? col : i === 5 ? (fill >= 100 ? C.green : C.text) : C.text, {
        mono: i >= 2 && i <= 4,
        weight: i === 0 ? 600 : 500,
      }),
    );
  }
};
