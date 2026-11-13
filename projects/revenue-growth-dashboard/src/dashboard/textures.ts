import { FONT_FAMILY } from "../lib/fonts";
import { clamp, hash01, mulberry32 } from "../lib/random";
import { AREA_POINTS, CANDLES, markerLabel } from "./data";
import type { Palette } from "./palette";

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  return { canvas: c, ctx };
};

const font = (px: number, weight = 400, italic = false) =>
  `${italic ? "italic " : ""}${weight} ${Math.round(px)}px ${FONT_FAMILY}, sans-serif`;

/* ------------------------------------------------------------------ */
/* Upper "Revenue Growth" panel                                        */
/* ------------------------------------------------------------------ */

export const UPPER_W = 4096;
export const UPPER_H = 1640;

// Chart frame (fractions of the panel texture).
const UL = 0.075;
const UR = 0.86;
const UT = 0.17;
const UB = 0.72; // value 0
export const VAL_MAX = 30;

export const ux = (x: number) => (UL + (UR - UL) * x) * UPPER_W;
export const uy = (v: number) => (UB - ((UB - UT) * v) / VAL_MAX) * UPPER_H;

export const drawUpperStatic = (ctx: CanvasRenderingContext2D, p: Palette) => {
  const W = UPPER_W;
  const H = UPPER_H;
  ctx.clearRect(0, 0, W, H);

  // faint glass backing
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, `rgba(${p.glassRgb},0.015)`);
  bg.addColorStop(1, `rgba(${p.glassRgb},0.04)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // horizontal grid lines (every 5 units)
  ctx.lineWidth = 3;
  for (let v = 0; v <= 35; v += 5) {
    ctx.strokeStyle = v % 10 === 0 ? p.grid : p.grid.replace(/[\d.]+\)$/, "0.16)");
    ctx.beginPath();
    ctx.moveTo(UL * W - 20, uy(v));
    ctx.lineTo(0.985 * W, uy(v));
    ctx.stroke();
  }

  // area chart (independent scale 2700..3300 mapped to 0.84H..0.08H)
  const ax0 = UL * W;
  const ax1 = 0.875 * W;
  const ayBottom = 0.84 * H;
  const ayTop = 0.07 * H;
  const n = AREA_POINTS.length;
  const pathTop = () => {
    for (let i = 0; i < n; i++) {
      const x = ax0 + ((ax1 - ax0) * i) / (n - 1);
      const y = ayBottom - (ayBottom - ayTop) * clamp(AREA_POINTS[i], 0, 1.02);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  ctx.beginPath();
  ctx.moveTo(ax0, ayBottom);
  pathTop();
  ctx.lineTo(ax1, ayBottom);
  ctx.closePath();
  const ag = ctx.createLinearGradient(0, ayTop, 0, ayBottom);
  ag.addColorStop(0, p.areaTop);
  ag.addColorStop(1, p.areaBottom);
  ctx.fillStyle = ag;
  ctx.fill();
  // horizontal fade at the left start
  const fade = ctx.createLinearGradient(ax0, 0, ax0 + 0.03 * W, 0);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = fade;
  ctx.fillRect(ax0 - 2, 0, 0.03 * W + 4, H);
  ctx.restore();
  ctx.beginPath();
  pathTop();
  ctx.strokeStyle = p.areaEdge;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // faint data bars at the left
  const rnd = mulberry32(55);
  for (let i = 0; i < 5; i++) {
    const y = 0.56 * H + i * 0.022 * H;
    const w = (0.06 + rnd() * 0.12) * W;
    ctx.fillStyle = `rgba(${p.dataRgb},${0.08 + rnd() * 0.12})`;
    ctx.fillRect(0.02 * W, y, w, 0.012 * H);
  }

  // title
  ctx.fillStyle = p.text;
  ctx.font = font(84, 500);
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Revenue Growth", 0.04 * W, 0.085 * H);

  // left axis labels
  ctx.font = font(62, 400);
  ctx.fillStyle = p.textDim;
  ctx.textAlign = "right";
  for (const v of [0, 10, 20, 30]) ctx.fillText(String(v), UL * W - 40, uy(v) + 22);

  // right axis labels (area chart scale)
  ctx.font = font(92, 400, true);
  ctx.fillStyle = p.text;
  ctx.textAlign = "left";
  const rl: Array<[string, number]> = [
    ["3200", 0.17],
    ["3000", 0.38],
    ["2800", 0.58],
  ];
  for (const [t, y] of rl) ctx.fillText(t, 0.9 * W, y * H);

  // timeframe buttons
  ctx.font = font(74, 400);
  ctx.textAlign = "center";
  ctx.fillStyle = p.text;
  const labels = ["1D", "1M", "3M", "1Y", "5Y", "All"];
  labels.forEach((l, i) => ctx.fillText(l, (0.18 + i * 0.062) * W, 0.9 * H));
  ctx.textAlign = "left";
};

const sstep = (e0: number, e1: number, x: number) => {
  const u = clamp((x - e0) / (e1 - e0), 0, 1);
  return u * u * (3 - 2 * u);
};

export const curveProgress = (t: number) => ({
  a: 0.93 * Math.pow(clamp((t - 0.35) / 19.45, 0, 1), 0.9) + 0.07 * sstep(13, 19.9, t),
  b: 0.95 * Math.pow(clamp((t - 0.85) / 18.95, 0, 1), 0.88) + 0.05 * sstep(13, 19.9, t),
});

/** Small static text label (marker values) as its own canvas. */
export const drawLabel = (text: string, color: string) => {
  const { canvas, ctx } = makeCanvas(512, 64);
  ctx.font = font(40, 400);
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 8, 34);
  return canvas;
};

/* ------------------------------------------------------------------ */
/* Lower candlestick panel                                             */
/* ------------------------------------------------------------------ */

export const LOWER_W = 4096;
export const LOWER_H = 1912;
const LL = 0.035;
const LR = 0.965;
const LT = 0.1;
const LB = 0.9;
export const lx = (x: number) => (LL + (LR - LL) * x) * LOWER_W;
export const ly = (v: number) => (LB - (LB - LT) * v) * LOWER_H;

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export const drawLowerStatic = (ctx: CanvasRenderingContext2D, p: Palette) => {
  const W = LOWER_W;
  const H = LOWER_H;
  ctx.clearRect(0, 0, W, H);

  // glass slab
  roundRect(ctx, 0.01 * W, 0.02 * H, 0.98 * W, 0.96 * H, 40);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, `rgba(${p.glassRgb},0.035)`);
  bg.addColorStop(1, `rgba(${p.glassRgb},0.02)`);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = p.frame;
  ctx.lineWidth = 5;
  ctx.stroke();

  // grid
  ctx.lineWidth = 2;
  ctx.strokeStyle = p.grid.replace(/[\d.]+\)$/, "0.07)");
  for (let i = 1; i < 8; i++) {
    const y = (0.02 + (0.96 * i) / 8) * H;
    ctx.beginPath();
    ctx.moveTo(0.01 * W, y);
    ctx.lineTo(0.99 * W, y);
    ctx.stroke();
  }
  for (let i = 1; i < 16; i++) {
    const x = (0.01 + (0.98 * i) / 16) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0.02 * H);
    ctx.lineTo(x, 0.98 * H);
    ctx.stroke();
  }

  // dark background area hump
  ctx.beginPath();
  ctx.moveTo(lx(0), ly(0));
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    const v = 0.35 + 0.25 * Math.sin(x * Math.PI * 1.3 + 0.4) + 0.05 * Math.sin(x * 31);
    ctx.lineTo(lx(x), ly(v));
  }
  ctx.lineTo(lx(1), ly(0));
  ctx.closePath();
  ctx.fillStyle = `rgba(${p.humpRgb},0.07)`;
  ctx.fill();

  // candles
  const n = CANDLES.length;
  const step = (lx(1) - lx(0)) / n;
  const bw = step * 0.5;
  CANDLES.forEach((c, i) => {
    const x = lx(0) + step * (i + 0.5);
    const up = c.c >= c.o;
    const mix = i / n;
    const col = up ? p.candleUp : p.candleDown;
    // glow
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = p.candleGlow;
    ctx.fillRect(x - bw * 1.4, ly(c.h), bw * 2.8, ly(c.l) - ly(c.h));
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(mix * 12);
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, ly(c.h));
    ctx.lineTo(x, ly(c.l));
    ctx.stroke();
    const top = ly(Math.max(c.o, c.c));
    const bot = ly(Math.min(c.o, c.c));
    const grad = ctx.createLinearGradient(0, top, 0, Math.max(bot, top + 6));
    grad.addColorStop(0, col);
    grad.addColorStop(0.35, col);
    grad.addColorStop(1, col);
    ctx.fillStyle = grad;
    ctx.fillRect(x - bw / 2, top, bw, Math.max(6, bot - top));
    ctx.globalAlpha = 1;
  });
};

/** Lower-panel reflection mapping for the revenue curves (canvas px). */
export const reflX = (x: number) => (0.08 + 0.78 * x) * LOWER_W;
export const reflY = (v: number) => (0.06 + (1 - v / VAL_MAX) * 0.55) * LOWER_H;

/* ------------------------------------------------------------------ */
/* Side panels                                                         */
/* ------------------------------------------------------------------ */

export const SIDE_W = 1024;
export const SIDE_H = 2048;

export const drawLeftPanel = (ctx: CanvasRenderingContext2D, p: Palette, t: number) => {
  const W = SIDE_W;
  const H = SIDE_H;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = `rgba(${p.glassRgb},0.03)`;
  ctx.fillRect(0, 0, W, H);
  // donuts
  const centers: Array<[number, number]> = [
    [0.62, 0.3],
    [0.45, 0.4],
    [0.28, 0.5],
  ];
  centers.forEach(([cx, cy], k) => {
    const x = cx * W;
    const y = cy * H;
    const r = 0.1 * W;
    let a0 = -Math.PI / 2 + t * 0.4 * (k % 2 ? -1 : 1);
    const segs = p.donut.length;
    for (let i = 0; i < segs; i++) {
      const span = (Math.PI * 2 * (0.6 + 0.8 * hash01(k * 31 + i))) / segs;
      ctx.strokeStyle = p.donut[(i + k) % segs];
      ctx.lineWidth = 26;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(x, y, r, a0, a0 + span * 0.92);
      ctx.stroke();
      a0 += span;
    }
    ctx.globalAlpha = 1;
  });
  // red bars
  for (let i = 0; i < 6; i++) {
    const h = (0.03 + 0.05 * hash01(i + 9) * (0.8 + 0.2 * Math.sin(t * 2 + i))) * H;
    ctx.fillStyle = p.accentWarm;
    ctx.fillRect((0.08 + i * 0.07) * W, 0.66 * H - h, 0.045 * W, h);
  }
  // cyan rows
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0.06 * W, (0.71 + i * 0.03) * H, (0.25 + 0.3 * hash01(i + 40)) * W, 0.012 * H);
  }
  ctx.globalAlpha = 1;
  // text rows
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = `rgba(${p.uiRgb},${0.18 + 0.2 * hash01(i)})`;
    ctx.fillRect(0.08 * W, (0.06 + i * 0.016) * H, (0.2 + 0.5 * hash01(i + 70)) * W, 0.007 * H);
  }
};

export const drawRightPanel = (ctx: CanvasRenderingContext2D, p: Palette, t: number) => {
  const W = SIDE_W;
  const H = SIDE_H;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = `rgba(${p.glassRgb},0.03)`;
  ctx.fillRect(0, 0, W, H);
  ctx.font = font(44, 500);
  ctx.fillStyle = p.textDim;
  ctx.fillText("Market Summary", 0.08 * W, 0.31 * H);
  // text rows
  for (let i = 0; i < 26; i++) {
    const y = (0.06 + i * 0.016) * H;
    if (y > 0.28 * H && y < 0.5 * H) continue;
    ctx.fillStyle = `rgba(${p.uiRgb},${0.16 + 0.25 * hash01(i + 300)})`;
    ctx.fillRect(0.08 * W, y, (0.15 + 0.45 * hash01(i + 77)) * W, 0.007 * H);
    ctx.fillRect(0.72 * W, y, 0.18 * W, 0.007 * H);
  }
  // teal highlight bars
  for (const y of [0.22, 0.43]) {
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0.05 * W, y * H, 0.85 * W, 0.016 * H);
  }
  ctx.globalAlpha = 1;
  // red mini area chart
  ctx.beginPath();
  ctx.moveTo(0.06 * W, 0.4 * H);
  for (let i = 0; i <= 60; i++) {
    const x = 0.06 + (i / 60) * 0.84;
    const v = 0.02 * (0.5 + hash01(i * 3 + 11)) + 0.008 * Math.sin(i * 0.4 + t * 1.5);
    ctx.lineTo(x * W, (0.4 - v) * H);
  }
  ctx.lineTo(0.9 * W, 0.4 * H);
  ctx.closePath();
  ctx.fillStyle = p.accentWarm;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  // small numbers
  ctx.font = font(36, 400);
  ctx.fillStyle = p.textDim;
  for (let i = 0; i < 6; i++) {
    ctx.fillText(markerLabel(500 + i), 0.08 * W, (0.53 + i * 0.03) * H);
  }
};

/** Dim, out-of-focus UI panels far behind the dashboard. */
export const drawFarPanel = (ctx: CanvasRenderingContext2D, p: Palette, seed: number) => {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const r = mulberry32(seed);
  ctx.fillStyle = `rgba(${p.glassRgb},0.06)`;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = i % 7 === 0 ? p.accent : `rgba(${p.uiRgb},${0.1 + r() * 0.25})`;
    ctx.globalAlpha = i % 7 === 0 ? 0.35 : 1;
    ctx.fillRect(r() * W * 0.9, r() * H * 0.9, (0.05 + r() * 0.3) * W, (0.01 + r() * 0.02) * H);
  }
  ctx.globalAlpha = 1;
};

/** Grid of dim cells on the foreground deck, with flickering blips. */
export const FLOOR_W = 2048;
export const FLOOR_H = 2048;
export const FLOOR_COLS = 48;
export const FLOOR_ROWS = 40;
export const drawFloor = (ctx: CanvasRenderingContext2D, p: Palette) => {
  const W = FLOOR_W;
  const H = FLOOR_H;
  ctx.clearRect(0, 0, W, H);
  const cw = W / FLOOR_COLS;
  const ch = H / FLOOR_ROWS;
  for (let j = 0; j < FLOOR_ROWS; j++) {
    for (let i = 0; i < FLOOR_COLS; i++) {
      ctx.fillStyle = p.floorCell;
      ctx.fillRect(i * cw + cw * 0.12, j * ch + ch * 0.2, cw * 0.76, ch * 0.6);
    }
  }
};

/** Cells that host a flickering light blip (cell column/row in one tile). */
export const FLOOR_BLIPS = (() => {
  const out: Array<{ i: number; j: number; phase: number }> = [];
  for (let j = 0; j < FLOOR_ROWS; j++) {
    for (let i = 0; i < FLOOR_COLS; i++) {
      const id = j * FLOOR_COLS + i;
      if (hash01(id) > 0.968) out.push({ i, j, phase: hash01(id + 999) * 90 });
    }
  }
  return out;
})();

/** Soft horizontal light-bar gradient (white core). */
export const drawGlowBar = (ctx: CanvasRenderingContext2D) => {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.42, "rgba(255,255,255,0.55)");
  g.addColorStop(0.5, "rgba(255,255,255,1)");
  g.addColorStop(0.58, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const fx = ctx.createLinearGradient(0, 0, W, 0);
  fx.addColorStop(0, "rgba(0,0,0,1)");
  fx.addColorStop(0.06, "rgba(0,0,0,0)");
  fx.addColorStop(0.94, "rgba(0,0,0,0)");
  fx.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = fx;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
};
