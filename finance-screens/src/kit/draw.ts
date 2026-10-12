// Shared chart-widget kit. Everything draws in Canvas 2D in design units
// (the ScreenCanvas transform maps them to texture pixels). No shadowBlur:
// glow is a core stroke plus 2-3 wider, fainter strokes, added with
// "lighter" compositing.

import { MONO, SANS, type WorldDots } from "../engine/assets";
import { PeriodicSeries } from "../engine/series";
import { hash, ticker, TAU, clamp } from "../engine/rng";

export type Ctx = CanvasRenderingContext2D;

const rgbCache = new Map<string, [number, number, number]>();
export const hexRgb = (hex: string): [number, number, number] => {
  let v = rgbCache.get(hex);
  if (!v) {
    const h = hex.replace("#", "");
    v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    rgbCache.set(hex, v);
  }
  return v;
};
export const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${clamp(a)})`;
};
export const mixHex = (a: string, b: string, t: number) => {
  const A = hexRgb(a);
  const B = hexRgb(b);
  const c = A.map((x, i) => Math.round(x + (B[i] - x) * t));
  return "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
};

export const font = (ctx: Ctx, size: number, weight = 400, mono = true) => {
  ctx.font = `${weight} ${size}px "${mono ? MONO : SANS}"`;
};

// ---------- glow strokes ----------

export type GlowSpec = [widthMul: number, alpha: number][];
export const GLOW_SOFT: GlowSpec = [
  [3, 0.22],
  [7, 0.09],
  [14, 0.04],
];
export const GLOW_STRONG: GlowSpec = [
  [2.5, 0.35],
  [6, 0.16],
  [13, 0.07],
];

export const glowStroke = (
  ctx: Ctx,
  path: Path2D,
  color: string,
  width: number,
  glow: GlowSpec = GLOW_SOFT,
  coreColor?: string,
  alpha = 1,
) => {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  for (let i = glow.length - 1; i >= 0; i--) {
    const [m, a] = glow[i];
    ctx.strokeStyle = rgba(color, a * alpha);
    ctx.lineWidth = width * m;
    ctx.stroke(path);
  }
  ctx.strokeStyle = rgba(coreColor ?? color, alpha);
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.globalCompositeOperation = prev;
};

export const glowDot = (
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 1,
  glow = 4,
) => {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * glow);
  g.addColorStop(0, rgba(color, 0.45 * alpha));
  g.addColorStop(0.35, rgba(color, 0.12 * alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r * glow, y - r * glow, r * glow * 2, r * glow * 2);
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = prev;
};

// ---------- line chart ----------

export type LineChartOpts = {
  x: number;
  y: number;
  w: number;
  h: number;
  series: PeriodicSeries;
  start: number; // series index at the left edge (real; scrolls)
  count: number; // points across the width
  color: string;
  width: number;
  glow?: GlowSpec;
  coreColor?: string;
  smooth?: boolean;
  nodes?: number; // node dot every N points (0 = none)
  nodeR?: number;
  nodeColor?: string;
  labels?: boolean; // small number labels next to nodes
  labelColor?: string;
  labelSize?: number;
  fill?: string; // area fill colour under the line
  fillAlpha?: number;
  alpha?: number;
  amp?: number; // vertical scale of [0,1] series, default 1
  clip?: boolean;
};

export const linePoints = (o: LineChartOpts) => {
  const dx = o.w / (o.count - 1);
  const i0 = Math.floor(o.start);
  const frac = o.start - i0;
  const pts: number[] = [];
  const amp = o.amp ?? 1;
  for (let k = -1; k <= o.count + 1; k++) {
    const v = o.series.get(i0 + k);
    pts.push(o.x + (k - frac) * dx, o.y + o.h - (0.5 + (v - 0.5) * amp) * o.h, i0 + k);
  }
  return pts; // triples x, y, index
};

const pathFrom = (pts: number[], smooth: boolean) => {
  const p = new Path2D();
  const n = pts.length / 3;
  p.moveTo(pts[0], pts[1]);
  if (!smooth) {
    for (let i = 1; i < n; i++) p.lineTo(pts[i * 3], pts[i * 3 + 1]);
  } else {
    for (let i = 0; i < n - 1; i++) {
      const x0 = pts[Math.max(0, i - 1) * 3];
      const y0 = pts[Math.max(0, i - 1) * 3 + 1];
      const x1 = pts[i * 3];
      const y1 = pts[i * 3 + 1];
      const x2 = pts[(i + 1) * 3];
      const y2 = pts[(i + 1) * 3 + 1];
      const x3 = pts[Math.min(n - 1, i + 2) * 3];
      const y3 = pts[Math.min(n - 1, i + 2) * 3 + 1];
      p.bezierCurveTo(
        x1 + (x2 - x0) / 6,
        y1 + (y2 - y0) / 6,
        x2 - (x3 - x1) / 6,
        y2 - (y3 - y1) / 6,
        x2,
        y2,
      );
    }
  }
  return p;
};

export const lineChart = (ctx: Ctx, o: LineChartOpts) => {
  const pts = linePoints(o);
  ctx.save();
  if (o.clip !== false) {
    ctx.beginPath();
    ctx.rect(o.x, o.y - o.h, o.w, o.h * 3);
    ctx.clip();
  }
  const alpha = o.alpha ?? 1;
  if (o.fill) {
    const p = pathFrom(pts, !!o.smooth);
    const n = pts.length / 3;
    p.lineTo(pts[(n - 1) * 3], o.y + o.h);
    p.lineTo(pts[0], o.y + o.h);
    p.closePath();
    const g = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
    g.addColorStop(0, rgba(o.fill, (o.fillAlpha ?? 0.35) * alpha));
    g.addColorStop(1, rgba(o.fill, 0));
    ctx.fillStyle = g;
    ctx.fill(p);
  }
  glowStroke(ctx, pathFrom(pts, !!o.smooth), o.color, o.width, o.glow, o.coreColor, alpha);
  if (o.nodes) {
    const n = pts.length / 3;
    for (let i = 0; i < n; i++) {
      const idx = pts[i * 3 + 2];
      if (((idx % o.nodes) + o.nodes) % o.nodes !== 0) continue;
      const x = pts[i * 3];
      const y = pts[i * 3 + 1];
      glowDot(ctx, x, y, o.nodeR ?? o.width * 1.6, o.nodeColor ?? o.color, alpha, 3);
      if (o.labels) {
        const s = o.labelSize ?? 14;
        font(ctx, s, 400);
        ctx.fillStyle = rgba(o.labelColor ?? o.color, 0.75 * alpha);
        const h1 = hash(idx, 11);
        ctx.fillText(
          `${(10000 + h1 * 89999).toFixed(0)}  ${(10000 + hash(idx, 12) * 89999).toFixed(0)}`,
          x - s * 2,
          y + (h1 > 0.5 ? s * 1.6 : -s * 0.9),
        );
      }
    }
  }
  ctx.restore();
  return pts;
};

// y of the chart line at design x (for markers riding the line)
export const lineYAt = (o: LineChartOpts, x: number) => {
  const dx = o.w / (o.count - 1);
  const idx = o.start + (x - o.x) / dx;
  const amp = o.amp ?? 1;
  return o.y + o.h - (0.5 + (o.series.at(idx) - 0.5) * amp) * o.h;
};

// ---------- candles ----------

export type CandleOpts = {
  x: number;
  y: number;
  w: number;
  h: number;
  series: PeriodicSeries;
  start: number;
  count: number;
  up: string;
  down: string;
  bodyW: number; // fraction of the step
  wickW: number;
  glow?: GlowSpec;
  alpha?: number;
  amp?: number;
  seed?: number;
  minBody?: number;
  wickMul?: number; // wick length scale (fraction of chart height), default 0.03
};

export const candles = (ctx: Ctx, o: CandleOpts) => {
  const dx = o.w / o.count;
  const i0 = Math.floor(o.start);
  const frac = o.start - i0;
  const alpha = o.alpha ?? 1;
  const amp = o.amp ?? 1;
  const seed = o.seed ?? 3;
  const Y = (v: number) => o.y + o.h - (0.5 + (v - 0.5) * amp) * o.h;
  const upPath = new Path2D();
  const downPath = new Path2D();
  const upWick = new Path2D();
  const downWick = new Path2D();
  const minBody = o.minBody ?? 1.5;
  for (let k = -1; k <= o.count + 1; k++) {
    const idx = i0 + k;
    const x = o.x + (k - frac + 0.5) * dx;
    if (x < o.x - dx || x > o.x + o.w + dx) continue;
    const a = o.series.get(idx);
    const b = o.series.get(idx + 1);
    const up = b >= a;
    const wm = o.wickMul ?? 0.03;
    const hiV = Math.max(a, b) + hash(idx, seed) * wm;
    const loV = Math.min(a, b) - hash(idx, seed + 1) * wm;
    const yTop = Y(Math.max(a, b));
    const yBot = Y(Math.min(a, b));
    const bw = dx * o.bodyW;
    const body = up ? upPath : downPath;
    body.rect(x - bw / 2, yTop, bw, Math.max(minBody, yBot - yTop));
    const wick = up ? upWick : downWick;
    wick.moveTo(x, Y(hiV));
    wick.lineTo(x, Y(loV));
  }
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  for (const [path, wick, col] of [
    [upPath, upWick, o.up],
    [downPath, downWick, o.down],
  ] as const) {
    if (o.glow) {
      for (const [m, a] of o.glow) {
        ctx.strokeStyle = rgba(col, a * alpha);
        ctx.lineWidth = o.wickW * m * 1.5;
        ctx.stroke(path);
        ctx.stroke(wick);
      }
    }
    ctx.strokeStyle = rgba(col, alpha);
    ctx.lineWidth = o.wickW;
    ctx.stroke(wick);
    ctx.fillStyle = rgba(col, alpha);
    ctx.fill(path);
  }
  ctx.globalCompositeOperation = prev;
};

// ---------- bars ----------

export const hBar = (
  ctx: Ctx,
  x: number,
  y: number,
  len: number,
  thick: number,
  color: string,
  capColor: string,
  alpha = 1,
  dot = true,
) => {
  if (len <= 0.5) return;
  const g = ctx.createLinearGradient(0, y, 0, y + thick);
  g.addColorStop(0, rgba(capColor, alpha));
  g.addColorStop(0.18, rgba(color, alpha * 0.95));
  g.addColorStop(1, rgba(color, alpha * 0.7));
  ctx.fillStyle = g;
  const r = thick * 0.18;
  ctx.beginPath();
  ctx.roundRect(x, y, len, thick, [0, r, r, 0]);
  ctx.fill();
  // bright top cap
  ctx.fillStyle = rgba(capColor, alpha * 0.9);
  ctx.fillRect(x, y, len, Math.max(1, thick * 0.08));
  if (dot) glowDot(ctx, x + len + thick * 0.5, y + thick * 0.5, thick * 0.3, mixHex(color, "#000000", 0.1), alpha * 0.9, 3);
};

export const vBar = (
  ctx: Ctx,
  x: number,
  base: number,
  w: number,
  h: number,
  c0: string,
  c1: string,
  alpha = 1,
  cap = true,
) => {
  if (h <= 0.5) return;
  const g = ctx.createLinearGradient(0, base, 0, base - h);
  g.addColorStop(0, rgba(c0, alpha * 0.85));
  g.addColorStop(1, rgba(c1, alpha));
  ctx.fillStyle = g;
  ctx.fillRect(x, base - h, w, h);
  if (cap) {
    ctx.fillStyle = rgba(mixHex(c1, "#ffffff", 0.3), alpha);
    ctx.fillRect(x, base - h, w, Math.max(1.5, w * 0.06));
  }
};

// ---------- donut ----------

export const donut = (
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  thick: number,
  segs: { v: number; color: string }[],
  progress = 1,
  gap = 0.035,
  alpha = 1,
  startAngle = -Math.PI / 2,
) => {
  const total = segs.reduce((s, x) => s + x.v, 0);
  let a = startAngle;
  const end = startAngle + TAU * clamp(progress);
  for (const s of segs) {
    const span = (s.v / total) * TAU;
    const a0 = a + gap / 2;
    const a1 = Math.min(a + span - gap / 2, end);
    if (a1 > a0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.arc(cx, cy, r - thick, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = rgba(s.color, alpha);
      ctx.fill();
    }
    a += span;
  }
};

export const arcGauge = (
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  w: number,
  frac: number,
  color: string,
  alpha = 1,
  start = -Math.PI * 0.5,
) => {
  ctx.lineWidth = w;
  ctx.strokeStyle = rgba(color, alpha * 0.18);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, start + TAU * clamp(frac));
  ctx.stroke();
};

// ---------- grid ----------

export const grid = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  step: number,
  majorEvery: number,
  color: string,
  minorA: number,
  majorA: number,
  offX = 0,
  offY = 0,
  lineW = 1,
) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const minor = new Path2D();
  const major = new Path2D();
  const ox = ((offX % step) + step) % step;
  const oy = ((offY % step) + step) % step;
  const baseI = Math.floor(offX / step);
  const baseJ = Math.floor(offY / step);
  for (let i = 0, gx = x - ox; gx <= x + w + step; i++, gx += step) {
    const p = ((i - baseI) % majorEvery + majorEvery) % majorEvery === 0 ? major : minor;
    p.moveTo(gx, y);
    p.lineTo(gx, y + h);
  }
  for (let j = 0, gy = y - oy; gy <= y + h + step; j++, gy += step) {
    const p = ((j - baseJ) % majorEvery + majorEvery) % majorEvery === 0 ? major : minor;
    p.moveTo(x, gy);
    p.lineTo(x + w, gy);
  }
  ctx.lineWidth = lineW;
  ctx.strokeStyle = rgba(color, minorA);
  ctx.stroke(minor);
  ctx.lineWidth = lineW * 1.6;
  ctx.strokeStyle = rgba(color, majorA);
  ctx.stroke(major);
  ctx.restore();
};

export const dottedLine = (
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  gap: number,
  r: number,
  color: string,
  alpha: number,
) => {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.floor(len / gap);
  ctx.fillStyle = rgba(color, alpha);
  for (let i = 0; i <= n; i++) {
    const t = i / Math.max(1, n);
    ctx.fillRect(x0 + (x1 - x0) * t - r, y0 + (y1 - y0) * t - r, r * 2, r * 2);
  }
};

export const crosshair = (ctx: Ctx, x: number, y: number, s: number, color: string, alpha: number, w = 1.5) => {
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x + s, y);
  ctx.moveTo(x, y - s);
  ctx.lineTo(x, y + s);
  ctx.stroke();
};

export const boxX = (ctx: Ctx, x: number, y: number, s: number, color: string, alpha: number, w = 1.5) => {
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = w;
  ctx.strokeRect(x, y, s, s);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s, y + s);
  ctx.moveTo(x + s, y);
  ctx.lineTo(x, y + s);
  ctx.stroke();
};

// ---------- text ----------

export const LABELS = [
  "INDEX",
  "VOLUME",
  "OPEN",
  "HIGH",
  "LOW",
  "CLOSE",
  "ACTIVE SEARCH",
  "MARKET DATA",
  "ANALYTICS",
];
export const CODES = [
  "IDX 01",
  "IDX 02",
  "IDX 07",
  "SER-A",
  "SER-B",
  "SER-C",
  "FX 03",
  "FX 07",
  "FX 12",
  "VOL 04",
  "DAT 09",
  "AN-22",
];

// Random but plausible numbers, stable for a given (seed, step).
export const fmtNum = (u: number, kind: number) => {
  switch (kind % 6) {
    case 0:
      return (1 + u * 8).toFixed(3); // 2.564
    case 1:
      return (10 + u * 89).toFixed(2); // 82.62
    case 2:
      return `${u > 0.42 ? "+" : "-"}${(u * 4.2).toFixed(2)}%`; // +1.38%
    case 3:
      return (1000 + u * 8999).toFixed(0); // 4862
    case 4:
      return (u * 99999).toFixed(0).padStart(5, "0"); // 03894
    default:
      return (100 + u * 899).toFixed(1); // 412.6
  }
};

// A column of numbers; some rows tick on a seeded schedule dividing 600.
export const numberColumn = (
  ctx: Ctx,
  x: number,
  y: number,
  rows: number,
  lineH: number,
  size: number,
  color: string,
  alpha: number,
  seed: number,
  frame: number,
  kind = -1,
  tickFrac = 0.4,
  align: CanvasTextAlign = "left",
) => {
  font(ctx, size, 400, true);
  ctx.textAlign = align;
  const periods = [10, 12, 15, 20, 24, 30, 40, 50, 60];
  for (let r = 0; r < rows; r++) {
    const h0 = hash(seed, r, 1);
    const ticks = h0 < tickFrac;
    const per = periods[Math.floor(hash(seed, r, 2) * periods.length)];
    const u = ticks ? ticker(frame, per, seed * 131 + r) : hash(seed, r, 3);
    const k = kind >= 0 ? kind : Math.floor(hash(seed, r, 4) * 6);
    const a = alpha * (0.55 + 0.45 * hash(seed, r, 5));
    ctx.fillStyle = rgba(color, a);
    ctx.fillText(fmtNum(u, k), x, y + r * lineH);
  }
  ctx.textAlign = "left";
};

// Small table: label column + several numeric columns.
export const dataTable = (
  ctx: Ctx,
  x: number,
  y: number,
  rows: number,
  colW: number[],
  lineH: number,
  size: number,
  color: string,
  alpha: number,
  seed: number,
  frame: number,
  accent?: string,
) => {
  font(ctx, size, 400, true);
  for (let r = 0; r < rows; r++) {
    let cx = x;
    for (let c = 0; c < colW.length; c++) {
      let txt: string;
      let col = color;
      if (c === 0) {
        txt = CODES[Math.floor(hash(seed, r, 9) * CODES.length)];
      } else {
        const tick = hash(seed, r * 7 + c, 1) < 0.35;
        const u = tick ? ticker(frame, [15, 20, 30, 60][c % 4], seed + r * 13 + c) : hash(seed, r * 7 + c, 2);
        const kind = c === colW.length - 1 ? 2 : (c + seed) % 6 === 2 ? 1 : (c + seed) % 6;
        txt = fmtNum(u, kind);
        if (accent && kind === 2 && txt.startsWith("-")) col = accent;
      }
      ctx.fillStyle = rgba(col, alpha * (c === 0 ? 0.8 : 1));
      ctx.fillText(txt, cx, y + r * lineH);
      cx += colW[c];
    }
  }
};

// Faint code text (generic, no brands)
const CODE_LINES = [
  "const series = feed.read(idx);",
  "if (buf.len >= MAX_LEN) flush(buf);",
  "for (i = 0; i < count; i++) {",
  "  sum += data[i] * weight[i];",
  "}",
  "node = queue.pop_front();",
  "ret = index.update(key, value);",
  "while (!stream.empty()) {",
  "  tick = stream.next();",
  "  spread = tick.ask - tick.bid;",
  "return response.status == OK;",
  "cache.set(id, snapshot);",
  "avg = (open + close) / 2.0;",
  "struct Quote { f64 bid; f64 ask; };",
  "elem->next = head; head = elem;",
  "volume += lot * qty;",
  "log.write(\"ANALYTICS\", t);",
  "delta = (close - open) / open;",
];
export const codeBlock = (
  ctx: Ctx,
  x: number,
  y: number,
  lines: number,
  lineH: number,
  size: number,
  color: string,
  alpha: number,
  seed: number,
) => {
  font(ctx, size, 400, true);
  ctx.fillStyle = rgba(color, alpha);
  for (let i = 0; i < lines; i++) {
    const l = CODE_LINES[Math.floor(hash(seed, i, 21) * CODE_LINES.length)];
    ctx.fillText(l, x + (l.startsWith("  ") ? size : 0), y + i * lineH);
  }
};

export const label = (
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  weight = 500,
  mono = false,
  spacing = 0,
) => {
  font(ctx, size, weight, mono);
  ctx.fillStyle = rgba(color, alpha);
  if (spacing) {
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x, y);
    ctx.letterSpacing = "0px";
  } else {
    ctx.fillText(text, x, y);
  }
};

// Rows of short dashes / blocks that read as dense data at a distance
export const dataDashes = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  rows: number,
  lineH: number,
  thick: number,
  color: string,
  alpha: number,
  seed: number,
) => {
  ctx.fillStyle = rgba(color, alpha);
  for (let r = 0; r < rows; r++) {
    let cx = x;
    let k = 0;
    while (cx < x + w) {
      const len = thick * (2 + hash(seed, r, k) * 10);
      if (hash(seed, r, k + 99) > 0.25) ctx.fillRect(cx, y + r * lineH, Math.min(len, x + w - cx), thick);
      cx += len + thick * (1 + hash(seed, r, k + 7) * 3);
      k++;
    }
  }
};

// ---------- map ----------

export const worldMap = (
  ctx: Ctx,
  world: WorldDots,
  x: number,
  y: number,
  w: number,
  color: string,
  alpha: number,
  frame: number,
  opts: { dot?: number; twinkle?: number; seed?: number; highlight?: string; square?: boolean; sub?: number } = {},
) => {
  const sub = opts.sub ?? 1;
  const cellPitch = w / world.cols;
  const pitch = cellPitch / sub;
  const r = (opts.dot ?? 0.62) * pitch * 0.5;
  const tw = opts.twinkle ?? 0.06;
  const seed = opts.seed ?? 5;
  ctx.fillStyle = rgba(color, alpha);
  const cells = world.cells;
  const bright: number[] = [];
  ctx.beginPath();
  for (let i = 0; i < cells.length; i += 2) {
    const c = cells[i];
    const rr = cells[i + 1];
    const id = i >> 1;
    if (sub > 1) {
      for (let a = 0; a < sub; a++)
        for (let b = 0; b < sub; b++) {
          const sx = x + c * cellPitch + (a + 0.5) * pitch;
          const sy = y + rr * cellPitch + (b + 0.5) * pitch;
          if (opts.square) ctx.rect(sx - r, sy - r, r * 2, r * 2);
          else {
            ctx.moveTo(sx + r, sy);
            ctx.arc(sx, sy, r, 0, TAU);
          }
        }
    }
    const px = x + (c + 0.5) * cellPitch;
    const py = y + (rr + 0.5) * cellPitch;
    if (tw > 0 && hash(seed, id, 1) < tw) {
      // twinkle: brightness on a whole-cycle sine with a seeded phase
      const ph = hash(seed, id, 2);
      const cyc = 1 + Math.floor(hash(seed, id, 3) * 4);
      bright.push(px, py, 0.5 + 0.5 * Math.sin(TAU * (cyc * frame / 600 + ph)));
      continue;
    }
    if (sub > 1) continue;
    if (opts.square) ctx.rect(px - r, py - r, r * 2, r * 2);
    else {
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, TAU);
    }
  }
  ctx.fill();
  const hc = opts.highlight ?? color;
  for (let i = 0; i < bright.length; i += 3) {
    ctx.fillStyle = rgba(hc, alpha * (0.4 + 1.2 * bright[i + 2]));
    ctx.beginPath();
    ctx.arc(bright[i], bright[i + 1], r * sub * 0.8 * (1 + 0.5 * bright[i + 2]), 0, TAU);
    ctx.fill();
  }
  return { h: world.rows * cellPitch };
};

// ---------- sparkline card ----------

export const sparkCard = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  series: PeriodicSeries,
  start: number,
  color: string,
  textColor: string,
  frame: number,
  seed: number,
  title: string,
) => {
  ctx.fillStyle = rgba(color, 0.06);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = rgba(color, 0.25);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  const cy = y + h * 0.18;
  const ch = h * 0.5;
  lineChart(ctx, {
    x: x + 4,
    y: cy,
    w: w - 8,
    h: ch,
    series,
    start,
    count: 48,
    color,
    width: 3,
    glow: [[2.5, 0.25]],
    fill: color,
    fillAlpha: 0.75,
    amp: 0.9,
  });
  label(ctx, title, x + 14, y + h * 0.82, h * 0.085, textColor, 0.65, 500);
  const u = ticker(frame, 30, seed);
  font(ctx, h * 0.12, 500, true);
  ctx.fillStyle = rgba(textColor, 0.95);
  ctx.fillText(fmtNum(u, 1), x + 14, y + h * 0.95);
  font(ctx, h * 0.075, 400, true);
  ctx.fillStyle = rgba(color, 0.95);
  ctx.textAlign = "right";
  ctx.fillText(fmtNum(ticker(frame, 30, seed + 1), 2), x + w - 14, y + h * 0.95);
  ctx.textAlign = "left";
};

// ---------- glints & flares ----------

// Thin diagonal light streak through (cx, cy).
export const glint = (
  ctx: Ctx,
  cx: number,
  cy: number,
  len: number,
  angle: number,
  width: number,
  color: string,
  alpha: number,
) => {
  const dx = Math.cos(angle) * len * 0.5;
  const dy = Math.sin(angle) * len * 0.5;
  const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = g;
  for (const [m, a] of [
    [8, 0.08],
    [3, 0.25],
    [1, 1],
  ]) {
    ctx.globalAlpha = a;
    ctx.lineWidth = width * m;
    ctx.beginPath();
    ctx.moveTo(cx - dx, cy - dy);
    ctx.lineTo(cx + dx, cy + dy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
};

// Soft wide light band (for diagonal sweeps)
export const lightBand = (
  ctx: Ctx,
  cx: number,
  cy: number,
  len: number,
  angle: number,
  width: number,
  color: string,
  alpha: number,
) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(-len / 2, -width / 2, len, width);
  ctx.restore();
};

export const flare = (
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
  streak = 6,
) => {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba("#ffffff", alpha));
  g.addColorStop(0.12, rgba(color, alpha * 0.8));
  g.addColorStop(0.4, rgba(color, alpha * 0.18));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (streak > 0) {
    // horizontal anamorphic streak
    const sw = r * streak;
    const sg = ctx.createLinearGradient(x - sw, 0, x + sw, 0);
    sg.addColorStop(0, rgba(color, 0));
    sg.addColorStop(0.5, rgba("#ffffff", alpha * 0.9));
    sg.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(x - sw, y - r * 0.05, sw * 2, r * 0.1);
    const sg2 = ctx.createLinearGradient(x - sw, 0, x + sw, 0);
    sg2.addColorStop(0, rgba(color, 0));
    sg2.addColorStop(0.5, rgba(color, alpha * 0.25));
    sg2.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = sg2;
    ctx.fillRect(x - sw, y - r * 0.18, sw * 2, r * 0.36);
  }
  ctx.globalCompositeOperation = prev;
};

export const panelFrame = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  fillA: number,
  edgeA: number,
  topA = edgeA * 2,
  lw = 1.5,
) => {
  ctx.fillStyle = rgba(color, fillA);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = rgba(color, edgeA);
  ctx.lineWidth = lw;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = rgba(color, topA);
  ctx.fillRect(x, y, w, lw * 1.5);
};

// Dense scatter of tiny HUD marks (dots, ticks, boxes, short labels, number
// snippets) over a rectangle: the "busy screen" texture between widgets.
export const hudScatter = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  color: string,
  alpha: number,
  seed: number,
  frame: number,
  scale = 1,
  accent?: string,
) => {
  for (let i = 0; i < count; i++) {
    const px = x + hash(seed, i, 1) * w;
    const py = y + hash(seed, i, 2) * h;
    const k = hash(seed, i, 3);
    const a = alpha * (0.4 + 0.6 * hash(seed, i, 4));
    const col = accent && hash(seed, i, 5) < 0.08 ? accent : color;
    if (k < 0.25) {
      ctx.fillStyle = rgba(col, a);
      ctx.fillRect(px, py, 3 * scale, 3 * scale);
    } else if (k < 0.4) {
      // tick cluster
      ctx.fillStyle = rgba(col, a * 0.8);
      for (let t = 0; t < 6; t++) ctx.fillRect(px + t * 6 * scale, py, 1.5 * scale, (6 + (t % 3) * 4) * scale);
    } else if (k < 0.52) {
      ctx.strokeStyle = rgba(col, a * 0.8);
      ctx.lineWidth = 1.5 * scale;
      ctx.strokeRect(px, py, (20 + 40 * hash(seed, i, 6)) * scale, (10 + 20 * hash(seed, i, 7)) * scale);
    } else if (k < 0.62) {
      crosshair(ctx, px, py, 8 * scale, col, a, 1.5 * scale);
    } else if (k < 0.82) {
      font(ctx, 16 * scale, 400, true);
      ctx.fillStyle = rgba(col, a);
      ctx.fillText(fmtNum(ticker(frame, [20, 30, 60][i % 3], seed * 977 + i), i), px, py);
    } else if (k < 0.9) {
      font(ctx, 14 * scale, 500, false);
      ctx.fillStyle = rgba(col, a * 0.8);
      ctx.fillText(LABELS[Math.floor(hash(seed, i, 8) * LABELS.length)], px, py);
    } else {
      ctx.fillStyle = rgba(col, a * 0.6);
      ctx.fillRect(px, py, (30 + 80 * hash(seed, i, 9)) * scale, 2 * scale);
    }
  }
};

// Bright pinpoint "nodes" with small halos
export const sparkles = (ctx: Ctx, x: number, y: number, w: number, h: number, count: number, color: string, alpha: number, seed: number, frame: number, r = 3) => {
  for (let i = 0; i < count; i++) {
    const tw = 0.6 + 0.4 * Math.sin(TAU * ((1 + (i % 3)) * frame / 600 + hash(seed, i, 3)));
    glowDot(ctx, x + hash(seed, i, 1) * w, y + hash(seed, i, 2) * h, r * (0.6 + 0.8 * hash(seed, i, 4)), color, alpha * tw, 4);
  }
};
