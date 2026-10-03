import {
  AREA_SMALL_VISIBLE,
  AREA_STEP,
  AREA_START,
  AREA_VISIBLE,
  CANDLE_FRAMES,
  Indicators,
  LIVE_START,
  ROLL,
  SCROLL_FRAMES,
  TICK,
  VersionData,
  indicators,
  liveValueAt,
} from "./data";
import { SignalLabel } from "./versions";

// ---------------------------------------------------------------------------
// Screen layout, in screen units (the flat UI before the camera transform).
// ---------------------------------------------------------------------------
export const SCREEN_W = 2900;
export const SCREEN_H = 1160;

const C = {
  bg: "#0E1A2E",
  bgDark: "#0A1424",
  bgRight: "#080E19",
  rowHi: "#18233A",
  grid: "rgba(130,160,210,0.1)",
  div: "#1F2E4A",
  text: "#D5DDEA",
  dim: "#6E7E99",
  green: "#2FD0A0",
  red: "#FF4A5A",
  blue: "#4F9CFF",
  orange: "#FF7A3F",
  grey: "#C3CAD6",
};

const MONO = "'JetBrains Mono', monospace";
const SANS = "Inter, sans-serif";

const HEADER_H = 56;
const LEFT_W = 1880; // left column incl. price axis
const PLOT_R = 1700; // plot area right edge (axis to the right)
const SP = 34; // candle spacing
const BODY_W = 21;
const RIGHT_SLOT = PLOT_R - 80; // x of the newest closed candle once scrolled

const MAIN = { y0: HEADER_H, y1: 560, ct: 86, cb: 432, vt: 440, vb: 556 };
const OSC = { y0: 560, y1: 770, pt: 586, pb: 754 };
const HIST = { y0: 770, y1: 950 };
const MACD = { y0: 950, y1: 1124 };
const RX = LEFT_W + 10; // right column x
const AREA = { x0: RX, x1: 2560, y0: HEADER_H, y1: 404, pl: RX + 10, pr: 2462, pt: 124, pb: 316 };
const AREA2 = { x0: 2568, x1: SCREEN_W, pl: 2580, pr: 2880 };
const SIG = { y0: 412, y1: SCREEN_H, head: 58 };

// ---------------------------------------------------------------------------
// Frame -> data snapshot (pure)
// ---------------------------------------------------------------------------
export type Snap = {
  live: number;
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
  ind: Indicators;
};

const tickStart = (frame: number) => {
  const k = Math.floor(frame / CANDLE_FRAMES);
  const pf = frame - k * CANDLE_FRAMES;
  return k * CANDLE_FRAMES + Math.floor(pf / TICK) * TICK;
};

export const snapshot = (d: VersionData, frame: number): Snap => {
  const f = Math.max(0, frame);
  const k = Math.floor(f / CANDLE_FRAMES);
  const tp = Math.floor((f - k * CANDLE_FRAMES) / TICK) * TICK;
  const live = LIVE_START + k;
  const cs = d.candles.slice(0, live + 1);
  const o = cs.map((x) => x.o);
  const h = cs.map((x) => x.h);
  const l = cs.map((x) => x.l);
  const c = cs.map((x) => x.c);
  const v = cs.map((x) => x.v);
  const lc = d.candles[live];
  let hi = lc.o;
  let lo = lc.o;
  for (let s = 0; s <= tp; s += TICK) {
    const x = liveValueAt(lc, s / (CANDLE_FRAMES - 1));
    hi = Math.max(hi, x);
    lo = Math.min(lo, x);
  }
  const t = tp / (CANDLE_FRAMES - 1);
  c[live] = liveValueAt(lc, t);
  h[live] = hi;
  l[live] = lo;
  v[live] = lc.v * (0.1 + 0.9 * t);
  return { live, o, h, l, c, v, ind: indicators(c, h, l) };
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
type Ctx = CanvasRenderingContext2D;

const glowLine = (ctx: Ctx, pts: [number, number][], color: string, w: number, glow = 1) => {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (glow > 0) {
    ctx.globalAlpha = 0.14 * glow;
    ctx.lineWidth = w * 6;
    ctx.stroke();
    ctx.globalAlpha = 0.28 * glow;
    ctx.lineWidth = w * 2.6;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = w;
  ctx.stroke();
};

const hline = (ctx: Ctx, x0: number, x1: number, y: number, color: string, w = 1.5) => {
  ctx.fillStyle = color;
  ctx.fillRect(x0, y - w / 2, x1 - x0, w);
};

const vline = (ctx: Ctx, x: number, y0: number, y1: number, color: string, w = 1.5) => {
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y0, w, y1 - y0);
};

/** Monospace text, right-aligned at x, rolling changed digits vertically. */
const rollText = (
  ctx: Ctx,
  text: string,
  prev: string | null,
  p: number,
  x: number,
  y: number,
  size: number,
) => {
  const cw = ctx.measureText("0").width;
  const n = Math.max(text.length, prev?.length ?? 0);
  const cur = text.padStart(n, " ");
  const old = (prev ?? text).padStart(n, " ");
  for (let i = 0; i < n; i++) {
    const cx = x - (n - i) * cw;
    if (p >= 1 || cur[i] === old[i]) {
      ctx.fillText(cur[i], cx, y);
      continue;
    }
    const e = easeInOut(p);
    const lh = size * 1.05;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 1, y - size * 0.62, cw + 2, size * 1.24);
    ctx.clip();
    ctx.fillText(old[i], cx, y - e * lh);
    ctx.fillText(cur[i], cx, y + (1 - e) * lh);
    ctx.restore();
  }
};

type TagStyle = { color: string; filled?: boolean };
type Tag = { y: number; text: string; prev: string | null; style: TagStyle };

// Per-draw scratch: resolved tag centres on the price/value axis, and axis
// labels deferred until tags are placed so a label never sits under a tag.
// Reset at the start of every drawScreen() call.
let tagYs: number[] = [];
let axisQueue: [string, number][] = [];
const axisLabel = (s: string, y: number) => axisQueue.push([s, y]);

const TAG_SIZE = 27;
const TAG_H = 40;

const drawTags = (ctx: Ctx, tags: Tag[], x: number, yMin: number, yMax: number, p: number) => {
  // Resolve overlaps deterministically: sort by y, push down, then pull up.
  const t = [...tags].sort((a, b) => a.y - b.y);
  const ys = t.map((g) => g.y);
  for (let i = 0; i < ys.length; i++) {
    ys[i] = Math.max(ys[i], yMin + TAG_H / 2, i ? ys[i - 1] + TAG_H + 3 : -Infinity);
  }
  for (let i = ys.length - 1; i >= 0; i--) {
    ys[i] = Math.min(ys[i], yMax - TAG_H / 2, i < ys.length - 1 ? ys[i + 1] - TAG_H - 3 : Infinity);
  }
  ctx.font = `600 ${TAG_SIZE}px ${MONO}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const cw = ctx.measureText("0").width;
  t.forEach((g, i) => {
    const y = ys[i];
    if (x < LEFT_W) tagYs.push(y);
    const n = Math.max(g.text.length, g.prev?.length ?? 0);
    const w = n * cw + 22;
    ctx.fillStyle = g.style.filled ? g.style.color : "#0B1526";
    ctx.beginPath();
    ctx.roundRect(x, y - TAG_H / 2, w, TAG_H, 5);
    ctx.fill();
    if (!g.style.filled) {
      ctx.strokeStyle = g.style.color;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    ctx.fillStyle = g.style.filled ? "#07101E" : g.style.color;
    rollText(ctx, g.text, g.prev, p, x + w - 11, y + 1, TAG_SIZE);
  });
};

const axisText = (ctx: Ctx, s: string, x: number, y: number, color = C.text, size = 26) => {
  ctx.font = `500 ${size}px ${MONO}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
};

const label = (ctx: Ctx, s: string, x: number, y: number, color: string, size: number, weight = 500) => {
  ctx.font = `${weight} ${size}px ${SANS}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
};

const niceStep = (range: number, target: number) => {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 2.25 ? 2 : n < 3.5 ? 2.5 : n < 7.5 ? 5 : 10) * mag;
};

const fmt = (x: number) => x.toFixed(2);
const fmtVol = (x: number) => `${(x / 1e6).toFixed(3)} M`;

// ---------------------------------------------------------------------------
// Signal icons (self-drawn)
// ---------------------------------------------------------------------------
const chevron = (ctx: Ctx, x: number, y: number, s: number, up: boolean) => {
  ctx.beginPath();
  ctx.moveTo(x - s, y + (up ? s * 0.5 : -s * 0.5));
  ctx.lineTo(x, y + (up ? -s * 0.5 : s * 0.5));
  ctx.lineTo(x + s, y + (up ? s * 0.5 : -s * 0.5));
  ctx.stroke();
};

const signalColor = (l: SignalLabel) =>
  l === "Sell" ? C.red : l === "Neutral" ? C.grey : C.green;

const drawSignal = (ctx: Ctx, l: SignalLabel, x: number, y: number) => {
  const col = signalColor(l);
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const ix = x + 16;
  if (l === "Buy") chevron(ctx, ix, y, 11, true);
  if (l === "Strong buy") {
    chevron(ctx, ix, y - 8, 11, true);
    chevron(ctx, ix, y + 8, 11, true);
  }
  if (l === "Sell") chevron(ctx, ix, y + 2, 11, false);
  if (l === "Neutral") ctx.fillRect(ix - 11, y - 2.5, 22, 5);
  label(ctx, l, x + 54, y + 1, col, 46, 500);
};

// ---------------------------------------------------------------------------
// Whole screen
// ---------------------------------------------------------------------------
export const drawScreen = (ctx: Ctx, d: VersionData, frame: number) => {
  tagYs = [];
  axisQueue = [];
  const k = Math.floor(frame / CANDLE_FRAMES);
  const pf = frame - k * CANDLE_FRAMES;
  const ts = tickStart(frame);
  const s = snapshot(d, frame);
  const prevS = ts > 0 ? snapshot(d, ts - 1) : null;
  const rollP = clamp01((frame - ts) / ROLL);
  const bear = d.version.drift < 0;
  const up = C.green;
  const dn = C.red;

  // --- backgrounds -------------------------------------------------------
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  // Faint backlight falloff across the chart column.
  const bgGlow = ctx.createRadialGradient(PLOT_R * 0.6, MAIN.cb, 0, PLOT_R * 0.6, MAIN.cb, 1400);
  bgGlow.addColorStop(0, "rgba(40,80,150,0.16)");
  bgGlow.addColorStop(1, "rgba(40,80,150,0)");
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, LEFT_W, SCREEN_H);
  ctx.fillStyle = C.bgRight;
  ctx.fillRect(RX, HEADER_H, SCREEN_W - RX, SCREEN_H - HEADER_H);
  ctx.fillStyle = "#050A13";
  ctx.fillRect(LEFT_W, HEADER_H, RX - LEFT_W, SCREEN_H);
  ctx.fillStyle = C.bgDark;
  ctx.fillRect(0, 0, SCREEN_W, HEADER_H);
  hline(ctx, 0, SCREEN_W, HEADER_H, C.div, 2);
  ["1m", "5m", "15m", "1H", "4H", "1D", "1W"].forEach((t, i) => {
    if (t === "1H") {
      ctx.fillStyle = "#1D2D4A";
      ctx.beginPath();
      ctx.roundRect(28 + i * 86 - 12, 10, 70, 36, 6);
      ctx.fill();
    }
    label(ctx, t, 28 + i * 86, 29, t === "1H" ? C.text : C.dim, 25, 500);
  });
  ["Indicators", "Compare", "Alerts", "Replay"].forEach((t, i) =>
    label(ctx, t, 720 + i * 190, 29, C.dim, 25, 500),
  );
  label(ctx, "Technicals", RX + 30, 29, C.dim, 25, 500);
  label(ctx, "Overview", RX + 230, 29, C.text, 25, 500);

  // --- candle geometry ---------------------------------------------------
  const e = easeInOut(pf / SCROLL_FRAMES);
  const lastSlot = s.live - 1 + e;
  const xOf = (i: number) => RIGHT_SLOT - (lastSlot - i) * SP;
  const iMin = Math.max(0, Math.floor(lastSlot - RIGHT_SLOT / SP) - 2);
  const idx: number[] = [];
  for (let i = iMin; i <= s.live; i++) idx.push(i);
  const fade = (x: number) => clamp01((x - 10) / 220); // left-edge weight for auto ranges

  const w = s.live - 1 + e;
  const w0 = Math.floor(w);
  const wf = w - w0;
  const lo = lerp(d.rangeLo[w0], d.rangeLo[w0 + 1], wf);
  const hi = lerp(d.rangeHi[w0], d.rangeHi[w0 + 1], wf);
  const vMax = lerp(d.volMax[w0], d.volMax[w0 + 1], wf);
  const yP = (p: number) => MAIN.cb - ((p - lo) / (hi - lo)) * (MAIN.cb - MAIN.ct);

  // --- left column grids ---------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HEADER_H, PLOT_R, SCREEN_H - HEADER_H);
  ctx.clip();
  for (const i of idx) {
    if (i % 12 === 0) vline(ctx, xOf(i), HEADER_H, MACD.y1, C.grid, 1.5);
  }
  ctx.restore();

  const step = niceStep(hi - lo, 7);
  const gridPrices: number[] = [];
  for (let p = Math.ceil(lo / step) * step; p < hi; p += step) gridPrices.push(p);
  for (const p of gridPrices) {
    const y = yP(p);
    if (y < MAIN.ct - 10 || y > MAIN.cb + 10) continue;
    hline(ctx, 0, PLOT_R, y, C.grid, 1.5);
    axisLabel(fmt(p), y);
  }

  // --- main: bands, volume, candles, averages ---------------------------
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HEADER_H + 2, PLOT_R, MAIN.y1 - HEADER_H - 4);
  ctx.clip();
  const ind = s.ind;
  const pts = (arr: number[], y: (v: number) => number) =>
    idx.filter((i) => !Number.isNaN(arr[i])).map((i) => [xOf(i), y(arr[i])] as [number, number]);

  // volume
  for (const i of idx) {
    const hgt = (s.v[i] / vMax) * (MAIN.vb - MAIN.vt) * 0.95;
    ctx.fillStyle = s.c[i] >= s.o[i] ? up : dn;
    ctx.globalAlpha = 0.78;
    ctx.fillRect(xOf(i) - 13, MAIN.vb - hgt, 26, hgt);
  }
  ctx.globalAlpha = 1;

  // Bollinger band fill
  const bu = pts(ind.bbU, yP);
  const bl = pts(ind.bbL, yP);
  ctx.beginPath();
  bu.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let j = bl.length - 1; j >= 0; j--) ctx.lineTo(bl[j][0], bl[j][1]);
  ctx.closePath();
  ctx.fillStyle = "rgba(79,156,255,0.16)";
  ctx.fill();
  glowLine(ctx, bu, C.blue, 4.6, 1.2);
  glowLine(ctx, bl, C.blue, 4.6, 1.2);

  // candles
  for (const i of idx) {
    const x = xOf(i);
    const col = s.c[i] >= s.o[i] ? up : dn;
    ctx.fillStyle = col;
    ctx.fillRect(x - 1.4, yP(s.h[i]), 2.8, yP(s.l[i]) - yP(s.h[i]));
    const yt = yP(Math.max(s.o[i], s.c[i]));
    const yb = yP(Math.min(s.o[i], s.c[i]));
    ctx.fillRect(x - BODY_W / 2, yt, BODY_W, Math.max(2.5, yb - yt));
  }

  glowLine(ctx, pts(ind.sma, yP), "#7DB6FF", 2.6, 0.6);
  glowLine(ctx, pts(ind.ema, yP), C.orange, 4.6, 1.2);

  // live price line
  const livePrice = s.c[s.live];
  const liveCol = livePrice >= s.o[s.live] ? up : dn;
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = liveCol;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, yP(livePrice));
  ctx.lineTo(PLOT_R, yP(livePrice));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.restore();

  label(ctx, "BB 20 2", 22, HEADER_H + 30, C.dim, 24);
  label(ctx, fmt(ind.bbU[s.live]), 128, HEADER_H + 30, C.blue, 24);
  label(ctx, "EMA 50", 270, HEADER_H + 30, C.dim, 24);
  label(ctx, fmt(ind.ema[s.live]), 362, HEADER_H + 30, C.orange, 24);
  label(ctx, "Vol", 22, MAIN.vt + 4, C.dim, 22);

  const pv = (arr: (sn: Snap) => number, f: (x: number) => string) =>
    prevS ? f(arr(prevS)) : null;
  drawTags(
    ctx,
    [
      { y: yP(ind.bbU[s.live]), text: fmt(ind.bbU[s.live]), prev: pv((x) => x.ind.bbU[x.live], fmt), style: { color: "#8EC2FF" } },
      { y: yP(ind.ema[s.live]), text: fmt(ind.ema[s.live]), prev: pv((x) => x.ind.ema[x.live], fmt), style: { color: C.orange } },
      { y: yP(livePrice), text: fmt(livePrice), prev: pv((x) => x.c[x.live], fmt), style: { color: liveCol, filled: true } },
      { y: yP(ind.sma[s.live]), text: fmt(ind.sma[s.live]), prev: pv((x) => x.ind.sma[x.live], fmt), style: { color: C.text } },
      { y: yP(ind.bbL[s.live]), text: fmt(ind.bbL[s.live]), prev: pv((x) => x.ind.bbL[x.live], fmt), style: { color: C.blue } },
    ],
    PLOT_R + 12,
    HEADER_H + 4,
    MAIN.cb + 30,
    rollP,
  );
  drawTags(
    ctx,
    [
      {
        y: MAIN.vb - (s.v[s.live] / vMax) * (MAIN.vb - MAIN.vt) * 0.95,
        text: fmtVol(s.v[s.live]),
        prev: pv((x) => x.v[x.live], fmtVol),
        style: { color: liveCol },
      },
    ],
    PLOT_R + 12,
    MAIN.cb + 34,
    MAIN.y1 - 4,
    rollP,
  );
  hline(ctx, 0, LEFT_W, MAIN.y1, C.div, 2.5);

  // --- oscillator --------------------------------------------------------
  const yO = (x: number) => OSC.pb - (x / 100) * (OSC.pb - OSC.pt);
  ctx.fillStyle = "rgba(79,156,255,0.09)";
  ctx.fillRect(0, yO(80), PLOT_R, yO(20) - yO(80));
  ctx.setLineDash([7, 9]);
  ctx.strokeStyle = "rgba(220,230,245,0.5)";
  ctx.lineWidth = 2;
  for (const lv of [80, 20]) {
    ctx.beginPath();
    ctx.moveTo(0, yO(lv));
    ctx.lineTo(PLOT_R, yO(lv));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const lv of [100, 80, 50, 20, 0]) axisLabel(lv.toFixed(2), yO(lv));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, OSC.y0 + 2, PLOT_R, OSC.y1 - OSC.y0 - 4);
  ctx.clip();
  glowLine(ctx, pts(ind.stK, yO), C.blue, 4.6, 1.2);
  glowLine(ctx, pts(ind.stD, yO), C.orange, 4.6, 1.2);
  ctx.restore();
  label(ctx, "Stoch 9 3 3", 22, OSC.y0 + 28, C.dim, 24);
  drawTags(
    ctx,
    [
      { y: yO(ind.stK[s.live]), text: fmt(ind.stK[s.live]), prev: pv((x) => x.ind.stK[x.live], fmt), style: { color: C.blue } },
      { y: yO(ind.stD[s.live]), text: fmt(ind.stD[s.live]), prev: pv((x) => x.ind.stD[x.live], fmt), style: { color: C.orange } },
    ],
    PLOT_R + 12,
    OSC.y0 + 6,
    OSC.y1 - 6,
    rollP,
  );
  hline(ctx, 0, LEFT_W, OSC.y1, C.div, 2.5);

  // --- histogram ----------------------------------------------------------
  let hm = 1e-9;
  for (const i of idx) {
    hm = Math.max(hm, Math.abs(ind.hist[i]) * fade(xOf(i)), Math.abs(ind.histSig[i]) * fade(xOf(i)));
  }
  hm *= 1.15;
  const hz = (HIST.y0 + HIST.y1) / 2 + 8;
  const hh = (HIST.y1 - HIST.y0) / 2 - 18;
  const yH = (x: number) => hz - (x / hm) * hh;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HIST.y0 + 2, PLOT_R, HIST.y1 - HIST.y0 - 4);
  ctx.clip();
  const gUp = ctx.createLinearGradient(0, hz - hh, 0, hz);
  gUp.addColorStop(0, "rgba(120,240,200,0.95)");
  gUp.addColorStop(0.5, "rgba(47,208,160,0.7)");
  gUp.addColorStop(1, "rgba(47,208,160,0.12)");
  const gDn = ctx.createLinearGradient(0, hz, 0, hz + hh);
  gDn.addColorStop(0, "rgba(255,74,90,0.12)");
  gDn.addColorStop(0.5, "rgba(255,74,90,0.7)");
  gDn.addColorStop(1, "rgba(255,150,160,0.95)");
  for (const i of idx) {
    const v = ind.hist[i];
    const y = yH(v);
    ctx.fillStyle = v >= 0 ? gUp : gDn;
    ctx.fillRect(xOf(i) - SP / 2 + 1, Math.min(y, hz), SP - 2, Math.abs(y - hz));
  }
  hline(ctx, 0, PLOT_R, hz, "rgba(220,230,245,0.25)", 1.5);
  glowLine(ctx, pts(ind.histSig, yH), "#F2F5FA", 2.6, 0.6);
  ctx.restore();
  axisLabel(fmt(hm / 1.15), yH(hm / 1.15));
  axisLabel("0.00", hz);
  axisLabel(fmt(-hm / 1.15), yH(-hm / 1.15));
  label(ctx, "Histogram", 22, HIST.y0 + 28, C.dim, 24);
  const hv = ind.hist[s.live];
  drawTags(
    ctx,
    [{ y: yH(hv), text: fmt(hv), prev: pv((x) => x.ind.hist[x.live], fmt), style: { color: hv >= 0 ? up : dn } }],
    PLOT_R + 12,
    HIST.y0 + 6,
    HIST.y1 - 6,
    rollP,
  );
  hline(ctx, 0, LEFT_W, HIST.y1, C.div, 2.5);

  // --- MACD lines ---------------------------------------------------------
  let mLo = Infinity;
  let mHi = -Infinity;
  for (const i of idx) {
    const f = fade(xOf(i));
    for (const v of [ind.macd[i], ind.sig[i]]) {
      mLo = Math.min(mLo, v * f);
      mHi = Math.max(mHi, v * f);
    }
  }
  const mPad = (mHi - mLo) * 0.15 + 1e-6;
  const yM = (x: number) =>
    MACD.y1 - 16 - ((x - (mLo - mPad)) / (mHi - mLo + 2 * mPad)) * (MACD.y1 - MACD.y0 - 46);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, MACD.y0 + 2, PLOT_R, MACD.y1 - MACD.y0 - 4);
  ctx.clip();
  glowLine(ctx, pts(ind.macd, yM), C.blue, 4.6, 1.2);
  glowLine(ctx, pts(ind.sig, yM), C.orange, 4.6, 1.2);
  ctx.restore();
  const mStep = niceStep(mHi - mLo + 1e-6, 2);
  for (let p = Math.ceil(mLo / mStep) * mStep; p <= mHi; p += mStep) axisLabel(fmt(p), yM(p));
  label(ctx, "MACD 12 26 9", 22, MACD.y0 + 28, C.dim, 24);
  drawTags(
    ctx,
    [
      { y: yM(ind.macd[s.live]), text: fmt(ind.macd[s.live]), prev: pv((x) => x.ind.macd[x.live], fmt), style: { color: C.blue } },
      { y: yM(ind.sig[s.live]), text: fmt(ind.sig[s.live]), prev: pv((x) => x.ind.sig[x.live], fmt), style: { color: C.orange } },
    ],
    PLOT_R + 12,
    MACD.y0 + 6,
    MACD.y1 - 6,
    rollP,
  );
  hline(ctx, 0, LEFT_W, MACD.y1, C.div, 2.5);
  for (const i of idx) {
    if (i % 12 !== 0) continue;
    const hr = (9 + Math.floor(i / 4)) % 24;
    const mn = (i % 4) * 15;
    axisText(ctx, `${String(hr).padStart(2, "0")}:${String(mn).padStart(2, "0")}`, xOf(i) - 40, MACD.y1 + 20, C.dim, 22);
  }
  vline(ctx, PLOT_R, HEADER_H, SCREEN_H, C.div, 2);
  for (const [txt, y] of axisQueue) {
    if (tagYs.some((ty) => Math.abs(ty - y) < TAG_H / 2 + 16)) continue;
    axisText(ctx, txt, PLOT_R + 24, y);
  }

  // --- area charts --------------------------------------------------------
  const ea = AREA_START + frame / AREA_STEP;
  drawArea(ctx, d.area, d.areaVol, ea, AREA.pl, AREA.pr, AREA_VISIBLE, bear ? dn : up, true, frame);
  drawArea(ctx, d.areaSmall, d.areaVol, ea, AREA2.pl, AREA2.pr, AREA_SMALL_VISIBLE, bear ? up : dn, false, frame);
  vline(ctx, AREA.x1 + 4, HEADER_H, AREA.y1, C.div, 2);
  hline(ctx, RX, SCREEN_W, AREA.y1 + 4, C.div, 3);

  // --- signal panel -------------------------------------------------------
  const sigTop = SIG.y0 + 8;
  label(ctx, "Oscillators", RX + 40, sigTop + SIG.head / 2, C.dim, 26);
  label(ctx, "Moving averages", RX + 40 + (SCREEN_W - RX) / 2, sigTop + SIG.head / 2, C.dim, 26);
  const rowsTop = sigTop + SIG.head;
  const rowH = (SIG.y1 - rowsTop) / 5;
  const colW = (SCREEN_W - RX) / 2;
  ctx.fillStyle = C.rowHi;
  ctx.fillRect(RX, rowsTop, SCREEN_W - RX, rowH);
  for (let r = 0; r <= 5; r++) hline(ctx, RX, SCREEN_W, rowsTop + r * rowH, C.div, 2.5);
  d.signals.forEach((cell, ci) => {
    const col = ci % 2;
    const row = Math.floor(ci / 2);
    const x = RX + col * colW + 40;
    const y = rowsTop + row * rowH + rowH / 2;
    let j = 0;
    while (j + 1 < cell.at.length && cell.at[j + 1] <= frame) j++;
    const p = j === 0 ? 1 : clamp01((frame - cell.at[j]) / 9);
    ctx.save();
    ctx.beginPath();
    ctx.rect(RX + col * colW, rowsTop + row * rowH + 3, colW, rowH - 6);
    ctx.clip();
    if (p < 1) {
      const ez = easeInOut(p);
      ctx.globalAlpha = 1 - ez;
      drawSignal(ctx, cell.labels[j - 1], x, y - ez * rowH * 0.6);
      ctx.globalAlpha = ez;
      drawSignal(ctx, cell.labels[j], x, y + (1 - ez) * rowH * 0.6);
      ctx.globalAlpha = 1;
    } else {
      drawSignal(ctx, cell.labels[j], x, y);
    }
    ctx.restore();
    if (col === 1) label(ctx, "—", SCREEN_W - 70, y, C.dim, 34);
  });
  vline(ctx, RX, HEADER_H, SCREEN_H, C.div, 2);
};

const drawArea = (
  ctx: Ctx,
  series: number[],
  vols: number[],
  ea: number,
  pl: number,
  pr: number,
  visible: number,
  color: string,
  big: boolean,
  frame: number,
) => {
  const dx = (pr - pl) / visible;
  const e0 = Math.floor(ea);
  const ef = ea - e0;
  const winRange = (end: number) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = end - visible - 1; i <= end + 1; i++) {
      lo = Math.min(lo, series[i]);
      hi = Math.max(hi, series[i]);
    }
    return [lo, hi];
  };
  const [l0, h0] = winRange(e0);
  const [l1, h1] = winRange(e0 + 1);
  const lo = lerp(l0, l1, ef);
  const hi = lerp(h0, h1, ef);
  const top = AREA.pt;
  const bot = AREA.pb;
  const y = (v: number) => bot - 10 - ((v - lo) / (hi - lo)) * (bot - top - 10);
  const pts: [number, number][] = [];
  for (let i = Math.floor(ea - visible) - 1; i <= e0; i++) pts.push([pr - (ea - i) * dx, y(series[i])]);
  const lastV = lerp(series[e0], series[e0 + 1], ef);
  pts.push([pr, y(lastV)]);

  // grid
  for (let g = 1; g < 5; g++) hline(ctx, pl - 10, pr, top + ((bot - top) * g) / 5, "rgba(130,160,210,0.06)", 1.5);

  ctx.save();
  ctx.beginPath();
  ctx.rect(pl - 10, AREA.y0 + 2, pr - pl + 10, AREA.y1 - AREA.y0 - 4);
  ctx.clip();
  // volume bars
  for (let i = Math.floor(ea - visible) - 1; i <= e0; i++) {
    const x = pr - (ea - i) * dx;
    const hgt = vols[i] * 40;
    ctx.fillStyle = series[i] >= series[i - 1] ? C.green : C.red;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x - dx * 0.3, bot + 44 - hgt, Math.max(2, dx * 0.6), hgt);
  }
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, color === C.red ? "rgba(255,74,90,0.55)" : "rgba(47,208,160,0.5)");
  g.addColorStop(0.55, color === C.red ? "rgba(150,20,35,0.35)" : "rgba(20,110,85,0.3)");
  g.addColorStop(1, color === C.red ? "rgba(80,10,20,0.05)" : "rgba(10,60,45,0.05)");
  ctx.beginPath();
  ctx.moveTo(pts[0][0], bot);
  pts.forEach(([x, yy]) => ctx.lineTo(x, yy));
  ctx.lineTo(pr, bot);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  glowLine(ctx, pts, color, big ? 4.2 : 3.6, 1.3);
  ctx.restore();

  // date axis
  for (let i = Math.floor(ea - visible); i <= e0; i++) {
    if (i % 24 !== 0) continue;
    const x = pr - (ea - i) * dx;
    if (x < pl + 10) continue;
    axisText(ctx, String(10 + ((i / 24) * 2) % 20), x - 14, AREA.y1 - 22, C.dim, 24);
  }
  if (big) {
    const step = niceStep(hi - lo, 4);
    for (let p = Math.ceil(lo / step) * step; p < hi; p += step) {
      const yy = y(p);
      if (yy > top && yy < bot - 20) axisText(ctx, fmt(p), pr + 14, yy, C.dim, 22);
    }
    const tickF = Math.floor(frame / AREA_STEP) * AREA_STEP;
    drawTags(
      ctx,
      [{ y: y(lastV), text: fmt(series[e0]), prev: fmt(series[e0 - 1]), style: { color, filled: true } }],
      pr + 8,
      top,
      bot,
      clamp01((frame - tickF) / ROLL),
    );
  }
};
