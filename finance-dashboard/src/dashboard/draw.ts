import {
  AXIS_X,
  BAR_COUNT,
  BAR_SPACING,
  BAR_START_X,
  BAR_WIDTH,
  BASELINE_Y,
  BOARD_H,
  BOARD_W,
  TEXELS_PER_UNIT,
} from "./constants";
import type { Palette } from "./palettes";
import { hash, noise1 } from "./random";

// Everything here draws in board units; the caller scales the context.
type Ctx = CanvasRenderingContext2D;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeOutBack = (t: number) => {
  const x = clamp01(t);
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

const withAlpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// ---------------------------------------------------------------------------
// Chart data
// ---------------------------------------------------------------------------

// Bars kick off quickly and then slow down, as in the reference:
// ~12 bars by 3 s, ~20 by 6 s and the last few still rising at 12 s.
const BAR_START_KNOTS: [number, number][] = [
  [0, 8],
  [12, 88],
  [20, 180],
  [26, 318],
  [BAR_COUNT - 1, 340],
];
export const barStartFrame = (i: number) => {
  for (let k = 1; k < BAR_START_KNOTS.length; k++) {
    const [i0, f0] = BAR_START_KNOTS[k - 1];
    const [i1, f1] = BAR_START_KNOTS[k];
    if (i <= i1) return f0 + ((i - i0) / (i1 - i0)) * (f1 - f0);
  }
  return BAR_START_KNOTS[BAR_START_KNOTS.length - 1][1];
};
const BAR_GROW_FRAMES = 42;

const barTarget = (i: number) =>
  70 + 1080 * Math.pow(i / (BAR_COUNT - 1), 1.25) + (hash(11, i) - 0.5) * 120;

const barHeight = (i: number, f: number) =>
  barTarget(i) * easeOutCubic((f - barStartFrame(i)) / BAR_GROW_FRAMES);

const barX = (i: number) => BAR_START_X + i * BAR_SPACING;

// Line chart vertices sit above every third bar.
const LINE_STEP = 3;
const lineVertex = (k: number) => {
  const i = k * LINE_STEP;
  return {
    x: barX(i),
    y: BASELINE_Y - barTarget(i) - 140 - hash(23, k) * 70,
  };
};

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

const drawAxes = (ctx: Ctx, p: Palette) => {
  ctx.strokeStyle = withAlpha(p.ink, 0.88);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(AXIS_X, 40);
  ctx.lineTo(AXIS_X, BASELINE_Y + 180);
  ctx.moveTo(AXIS_X - 50, BASELINE_Y);
  ctx.lineTo(2400, BASELINE_Y);
  ctx.stroke();
};

const drawBars = (ctx: Ctx, p: Palette, f: number) => {
  for (let i = 0; i < BAR_COUNT; i++) {
    const h = barHeight(i, f);
    if (h <= 0.5) continue;
    const x = barX(i);
    // Soft halo, then the bright core.
    ctx.fillStyle = withAlpha(p.bar, 0.16);
    ctx.fillRect(x - BAR_WIDTH, BASELINE_Y - h - 3, BAR_WIDTH * 3, h + 3);
    ctx.fillStyle = p.bar;
    ctx.fillRect(x, BASELINE_Y - h, BAR_WIDTH, h);
  }
};

const labelNumber = (k: number, f: number) => {
  // Digits keep re-rolling like a live ticker; more digits as time goes on.
  const digits = Math.min(5, 3 + Math.floor((f + k * 10) / 90));
  const tick = Math.floor(f / 5);
  let s = "";
  for (let d = 0; d < digits; d++) {
    s += Math.floor(hash(31, k, tick, d) * 10).toString();
  }
  return s;
};

const drawLineChart = (ctx: Ctx, p: Palette, f: number) => {
  const lastK = Math.floor((BAR_COUNT - 1) / LINE_STEP);
  // The head of the line tracks the growth of the bars.
  let head = -1;
  for (let k = 0; k <= lastK; k++) {
    const g = (f - barStartFrame(k * LINE_STEP) - 6) / 30;
    if (g <= 0) break;
    head = k - 1 + clamp01(g);
  }
  if (head < 0) return;

  const pts: { x: number; y: number }[] = [];
  const whole = Math.floor(head);
  for (let k = 0; k <= whole; k++) pts.push(lineVertex(k));
  const frac = head - whole;
  if (frac > 0 && whole + 1 <= lastK) {
    const a = lineVertex(whole);
    const b = lineVertex(whole + 1);
    pts.push({ x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac });
  }

  ctx.strokeStyle = withAlpha(p.ink, 0.9);
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  // Start just left of the axis, as in the reference.
  ctx.moveTo(AXIS_X - 40, pts[0].y + 120);
  for (const pt of pts) ctx.lineTo(pt.x, pt.y);
  ctx.stroke();

  ctx.font = "600 21px 'DejaVu Sans Mono', monospace";
  ctx.textBaseline = "middle";
  // Label every other vertex, leaving room for the head's own label.
  for (let k = 0; k < pts.length - 2; k += 2) {
    const v = pts[k];
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(v.x - 70, v.y - 26, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(p.accent, 0.95);
    ctx.fillText(labelNumber(k, f), v.x - 58, v.y - 26);
  }

  // Head marker: bright dot with a ring, plus its own live label.
  const end = pts[pts.length - 1];
  ctx.fillStyle = p.ink;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(p.ink, 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(end.x - 110, end.y - 22, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText(labelNumber(99, f), end.x - 98, end.y - 22);
};

// Row of small wedges under the x-axis that sweep open.
const drawWedgeRow = (ctx: Ctx, p: Palette, f: number) => {
  const count = 10;
  ctx.fillStyle = p.accent;
  for (let i = 0; i < count; i++) {
    const x = 990 + i * 68;
    const y = BASELINE_Y + 85;
    const appear = easeOutBack((f + 20 - i * 6) / 20);
    if (appear <= 0) continue;
    // Solid "pac-man" wedges that keep opening and closing.
    // Each wedge opens from a thin slice to a full "pac-man".
    const open = easeOutCubic((f + 10 - i * 6) / 45);
    const frac = (0.08 + 0.82 * open) * (0.6 + 0.4 * noise1(40 + i, f / 40 + i * 0.37));
    const rot = hash(41, i) * Math.PI * 2 + f * 0.012;
    const r = 22 * appear;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, rot, rot + frac * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
  // Block row at the end of the wedges, under the far end of the x-axis.
  const x0 = 990 + count * 68 + 20;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 12; c++) {
      if (hash(42, r, c, Math.floor(f / 9)) < 0.3) continue;
      ctx.fillStyle = withAlpha(p.accent, 0.9);
      ctx.fillRect(x0 + c * 30 + r * 14, BASELINE_Y + 40 + r * 34, 22, 16);
    }
  }
};

// Black/white pie icons that rotate.
const drawPieIcons = (ctx: Ctx, p: Palette, f: number) => {
  const groups = [
    { x: 985, y: 520, start: 45 },
    { x: 1290, y: 400, start: 115 },
  ];
  for (const [gi, g] of groups.entries()) {
    for (let j = 0; j < 3; j++) {
      const s = easeOutBack((f - g.start - j * 14) / 16);
      if (s <= 0) continue;
      const x = g.x + j * 82;
      const r = 25 * s;
      const a = hash(50, gi, j) * Math.PI * 2 + f * 0.02 * (j % 2 ? 1 : -1);
      const frac = 0.35 + 0.3 * noise1(51 + gi * 3 + j, f / 50);
      ctx.fillStyle = p.inkDark;
      ctx.beginPath();
      ctx.arc(x, g.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.ink;
      ctx.beginPath();
      ctx.moveTo(x, g.y);
      ctx.arc(x, g.y, r, a, a + frac * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = withAlpha(p.ink, 0.85);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, g.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
};

// 3x5 dot-matrix glyphs.
const GLYPHS = [
  "111101101101111",
  "010110010010111",
  "111001111100111",
  "111001111001111",
  "101101111001001",
  "111100111001111",
  "111100111101111",
  "111001001001001",
  "111101111101111",
  "111101111001111",
];

const drawDotMatrix = (
  ctx: Ctx,
  p: Palette,
  f: number,
  x0: number,
  y0: number,
  chars: number,
  seed: number,
  dot = 6,
  start = -Infinity,
) => {
  if (f < start) return;
  const step = dot * 2.6;
  const tick = Math.floor(f / 8);
  ctx.fillStyle = p.accent;
  for (let c = 0; c < chars; c++) {
    const g = GLYPHS[Math.floor(hash(seed, c, tick) * 10)];
    for (let r = 0; r < 5; r++) {
      for (let q = 0; q < 3; q++) {
        if (g[r * 3 + q] !== "1") continue;
        ctx.beginPath();
        ctx.arc(x0 + (c * 4 + q) * step, y0 + r * step, dot, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
};

// Vertical stacks of small squares that flicker.
const drawSquareStacks = (ctx: Ctx, p: Palette, f: number) => {
  const stacks = [
    { x: 1185, y: 600, n: 4 },
    { x: 1445, y: 470, n: 5 },
    { x: 1620, y: 640, n: 3 },
    { x: 1105, y: 700, n: 2 },
    { x: 1560, y: 330, n: 4 },
    { x: 940, y: 790, n: 2 },
  ];
  for (const [si, s] of stacks.entries()) {
    const appear = (f - 30 - si * 8) / 10;
    if (appear <= 0) continue;
    const tick = Math.floor(f / 10);
    const n = Math.max(1, s.n - Math.floor(hash(60, si, tick) * 2));
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = withAlpha(p.accent, 0.92);
      ctx.fillRect(s.x, s.y + j * 26, 18, 18);
    }
  }
};

const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789:.-";

// Tiny pseudo-text blocks that type themselves in.
const drawTextBlock = (
  ctx: Ctx,
  p: Palette,
  f: number,
  x: number,
  y: number,
  cols: number,
  rows: number,
  seed: number,
  start: number,
  size = 14,
) => {
  const typed = (f - start) * 6;
  if (typed <= 0) return;
  ctx.font = `bold ${size}px 'DejaVu Sans Mono', monospace`;
  ctx.textBaseline = "top";
  ctx.fillStyle = p.ink;
  // Soft glow around the glyphs, like the reference's blurred text columns.
  ctx.shadowColor = withAlpha(p.ink, 0.8);
  ctx.shadowBlur = size * 0.6 * TEXELS_PER_UNIT;
  let budget = typed;
  for (let r = 0; r < rows && budget > 0; r++) {
    const len = Math.floor(cols * (0.45 + 0.55 * hash(seed, r, 1)));
    const shown = Math.min(len, Math.floor(budget));
    budget -= len;
    let line = "";
    const tick = Math.floor(f / 15);
    for (let c = 0; c < shown; c++) {
      const h = hash(seed, r, c, hash(seed, r, tick) < 0.15 ? tick : 0);
      line += h < 0.07 ? " " : CHARS[Math.floor(h * CHARS.length)];
    }
    ctx.fillText(line, x, y + r * size * 1.25);
  }
  ctx.shadowBlur = 0;
};

const drawAreaChart = (
  ctx: Ctx,
  p: Palette,
  f: number,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
) => {
  ctx.strokeStyle = withAlpha(p.accent, 0.45);
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = withAlpha(p.accent, 0.82);
  ctx.beginPath();
  ctx.moveTo(x + 10, y + h - 10);
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const v = 0.3 + 0.6 * noise1(seed + i, f / 45 + i * 0.6);
    ctx.lineTo(x + 10 + ((w - 20) * i) / n, y + h - 10 - (h - 30) * v);
  }
  ctx.lineTo(x + w - 10, y + h - 10);
  ctx.closePath();
  ctx.fill();
};

const drawHistogram = (
  ctx: Ctx,
  p: Palette,
  f: number,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  const n = 42;
  ctx.fillStyle = withAlpha(p.accent, 0.9);
  for (let i = 0; i < n; i++) {
    const v = 0.25 + 0.75 * noise1(70 + i, f / 12 + i * 0.9);
    const bh = (h - 10) * v;
    ctx.fillRect(x + (w * i) / n, y + h - bh, 3.4, bh);
  }
  ctx.strokeStyle = withAlpha(p.accent, 0.45);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 6, y + h + 2);
  ctx.lineTo(x + w + 6, y + h + 2);
  ctx.stroke();
};

const drawBlockGrid = (
  ctx: Ctx,
  p: Palette,
  f: number,
  x: number,
  y: number,
  cols: number,
  rows: number,
  seed: number,
) => {
  const tick = Math.floor(f / 7);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (hash(seed, r, c, tick) < 0.38) continue;
      ctx.fillStyle = withAlpha(p.accent, 0.88);
      ctx.fillRect(x + c * 34, y + r * 34, 25, 18);
    }
  }
};

const drawDashColumn = (
  ctx: Ctx,
  p: Palette,
  f: number,
  x: number,
  y: number,
  rows: number,
) => {
  const tick = Math.floor(f / 6);
  ctx.fillStyle = withAlpha(p.accent, 0.85);
  for (let r = 0; r < rows; r++) {
    const a = hash(80, r, tick);
    if (a < 0.2) continue;
    ctx.fillRect(x + (a > 0.6 ? 70 : 0), y + r * 36, 34, 4.5);
    if (hash(81, r, tick) > 0.55) ctx.fillRect(x + 150, y + r * 36, 34, 4.5);
  }
};

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

// The grid and background are procedural in the board shader, so the
// texture only carries the widgets on a transparent board.
export const drawDashboard = (ctx: Ctx, p: Palette, f: number) => {
  ctx.clearRect(0, 0, BOARD_W, BOARD_H);

  // Left info column.
  drawDotMatrix(ctx, p, f, 630, 90, 4, 1, 4.5);
  drawTextBlock(ctx, p, f, 690, 210, 12, 26, 2, -60, 14);
  drawAreaChart(ctx, p, f, 560, 720, 270, 180, 3);

  drawAxes(ctx, p);
  drawWedgeRow(ctx, p, f);
  drawBars(ctx, p, f);
  drawLineChart(ctx, p, f);

  // Floating widgets above the chart.
  drawPieIcons(ctx, p, f);
  drawDotMatrix(ctx, p, f, 1500, 190, 2, 4, 5, 150);
  drawDotMatrix(ctx, p, f, 1060, 300, 3, 5, 4.5, 105);
  drawSquareStacks(ctx, p, f);
  drawTextBlock(ctx, p, f, 1210, 610, 8, 6, 6, 40);
  drawTextBlock(ctx, p, f, 1500, 560, 10, 5, 7, 55);
  drawTextBlock(ctx, p, f, 960, 830, 9, 4, 8, 30);
  drawTextBlock(ctx, p, f, 1640, 360, 7, 7, 9, 80);

  // Right-hand panel.
  drawBlockGrid(ctx, p, f, 2360, 150, 9, 3, 12);
  drawHistogram(ctx, p, f, 2360, 360, 330, 200);
  drawAreaChart(ctx, p, f, 2350, 610, 350, 210, 13);
  drawTextBlock(ctx, p, f, 2360, 900, 11, 30, 14, -30, 15);
  drawDashColumn(ctx, p, f, 2540, 910, 16);
};
