import { rng } from "../lib/useThreeScene";

/**
 * Procedural infographic sprite atlas (Canvas 2D) and glyph atlas.
 * Everything is generated from fixed seeds, so every browser tab that renders
 * frames produces identical textures.
 */

export const FONT_FAMILY = "InterLightFin";

export type SpriteKind =
  | "area"
  | "bars"
  | "teal"
  | "pie"
  | "donut"
  | "line"
  | "mini"
  | "table";

export const KIND_ID: Record<SpriteKind, number> = {
  area: 0,
  bars: 1,
  teal: 2,
  pie: 3,
  donut: 4,
  line: 5,
  mini: 6,
  table: 7,
};

export type Sprite = {
  kind: SpriteKind;
  /** u0, v0, u1, v1 in atlas UV space (v up). */
  uv: [number, number, number, number];
  aspect: number; // width / height
};

export type ChartColors = {
  red: string;
  yellow: string;
  blue: string;
  greenDark: string;
  greenLight: string;
  teal: string;
  pastel: string[];
  donut: string[];
  ink: string;
  inkLight: string;
};

export const ATLAS_W = 8192;
export const ATLAS_H = 4096;
const CW = 1024;
const CH = 512;
const COLS = ATLAS_W / CW; // 8
const ROWS = ATLAS_H / CH; // 8
const PAD = 40;

const KIND_PLAN: [SpriteKind, number][] = [
  ["area", 12],
  ["bars", 10],
  ["teal", 8],
  ["pie", 8],
  ["donut", 8],
  ["line", 13],
  ["mini", 3],
  ["table", 2],
];

const fmtNumber = (r: () => number) => {
  const sign = r() < 0.45 ? "-" : "";
  const a = Math.floor(1000 + r() * 30000);
  const b = Math.floor(r() * 1000)
    .toString()
    .padStart(3, "0");
  return `${sign}${a},${b}`;
};

const smoothSeries = (r: () => number, n: number, lo: number, hi: number) => {
  const pts: number[] = [];
  let v = lo + (hi - lo) * r();
  for (let i = 0; i < n; i++) {
    v += (r() - 0.5) * (hi - lo) * 0.55;
    v = Math.max(lo, Math.min(hi, v));
    pts.push(v);
  }
  return pts;
};

const drawArea = (
  ctx: CanvasRenderingContext2D,
  r: () => number,
  w: number,
  h: number,
  c: ChartColors,
) => {
  // overlapping translucent layers with sharp peaks (like the reference)
  const layers = [
    { col: c.red, lo: 0.3, hi: 1.0 },
    { col: c.yellow, lo: 0.2, hi: 0.78 },
    { col: c.blue, lo: 0.1, hi: 0.55 },
  ];
  const base = h * 0.86;
  for (const L of layers) {
    const n = 4 + Math.floor(r() * 4);
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let i = 0; i < n; i++) {
      const v = L.lo + (L.hi - L.lo) * r();
      ctx.lineTo((i / (n - 1)) * w, base - v * base * 0.95);
    }
    ctx.lineTo(w, base);
    ctx.closePath();
    ctx.globalAlpha = 0.84;
    ctx.fillStyle = L.col;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = c.inkLight;
  ctx.font = `300 ${Math.round(h * 0.085)}px ${FONT_FAMILY}`;
  ctx.fillText(fmtNumber(r), w * 0.02, h * 0.985);
  if (r() < 0.6) ctx.fillText(fmtNumber(r), w * 0.6, h * 0.985);
};

const drawBars = (
  ctx: CanvasRenderingContext2D,
  r: () => number,
  w: number,
  h: number,
  c: ChartColors,
) => {
  const n = 6 + Math.floor(r() * 10);
  const gap = 0.35 + r() * 0.4;
  const bw = w / (n + (n - 1) * gap);
  for (let i = 0; i < n; i++) {
    const v = 0.15 + r() * 0.85;
    ctx.fillStyle = i % 2 === 0 ? c.greenDark : c.greenLight;
    if (r() < 0.2) ctx.fillStyle = c.greenLight;
    ctx.globalAlpha = 0.95;
    const x = i * bw * (1 + gap);
    ctx.fillRect(x, h * (1 - v), bw, h * v);
  }
  ctx.globalAlpha = 1;
};

const drawTeal = (
  ctx: CanvasRenderingContext2D,
  r: () => number,
  w: number,
  h: number,
  c: ChartColors,
) => {
  const n = 6 + Math.floor(r() * 7);
  const bw = w / (n * 1.35);
  for (let i = 0; i < n; i++) {
    const v = 0.45 + r() * 0.55;
    ctx.fillStyle = c.teal;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(i * bw * 1.35, h * (1 - v) * 0.9, bw, h * v * 0.9);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = c.teal;
  ctx.fillRect(0, h * 0.93, w * 0.97, h * 0.025);
};

const drawPie = (
  ctx: CanvasRenderingContext2D,
  r: () => number,
  s: number,
  c: ChartColors,
) => {
  const n = 3 + Math.floor(r() * 3);
  const parts = Array.from({ length: n }, () => 0.4 + r());
  const tot = parts.reduce((a, b) => a + b, 0);
  let a0 = -Math.PI / 2 + r() * Math.PI;
  const cx = s / 2;
  const cy = s / 2;
  const rad = s * 0.47;
  const off = Math.floor(r() * c.pastel.length);
  parts.forEach((p, i) => {
    const a1 = a0 + (p / tot) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rad, a0, a1);
    ctx.closePath();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = c.pastel[(i + off) % c.pastel.length];
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = s * 0.006;
    ctx.stroke();
    a0 = a1;
  });
  ctx.globalAlpha = 1;
};

const drawDonut = (
  ctx: CanvasRenderingContext2D,
  r: () => number,
  s: number,
  c: ChartColors,
) => {
  const n = 3 + Math.floor(r() * 4);
  const parts = Array.from({ length: n }, () => 0.3 + r());
  const tot = parts.reduce((a, b) => a + b, 0);
  const full = r() < 0.75 ? Math.PI * 2 : Math.PI * (1.1 + r() * 0.7);
  let a0 = -Math.PI / 2 + r() * Math.PI * 2;
  const rad = s * 0.42;
  const thick = s * (0.05 + r() * 0.06);
  const off = Math.floor(r() * c.donut.length);
  ctx.lineCap = "butt";
  parts.forEach((p, i) => {
    const a1 = a0 + (p / tot) * full;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, rad, a0 + 0.02, a1 - 0.02);
    ctx.strokeStyle = c.donut[(i + off) % c.donut.length];
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = thick;
    ctx.stroke();
    a0 = a1;
  });
  ctx.globalAlpha = 1;
};

const drawLine = (
  ctx: CanvasRenderingContext2D,
  r: () => number,
  w: number,
  h: number,
  c: ChartColors,
) => {
  const n = 5 + Math.floor(r() * 5);
  const pts: [number, number][] = [];
  let y = 0.08 + r() * 0.15;
  for (let i = 0; i < n; i++) {
    y += (r() - 0.15) * 0.2;
    y = Math.max(0.08, Math.min(0.92, y));
    pts.push([0.04 + (i / (n - 1)) * 0.92, y]);
  }
  ctx.strokeStyle = c.inkLight;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = h * 0.004;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, h * (0.2 + i * 0.22));
    ctx.lineTo(w, h * (0.2 + i * 0.22));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = h * 0.016;
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    const X = px * w;
    const Y = h * (1 - py);
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  });
  ctx.stroke();
  pts.forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px * w, h * (1 - py), h * 0.03, 0, Math.PI * 2);
    ctx.fillStyle = c.ink;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
};

const drawMini = (
  ctx: CanvasRenderingContext2D,
  r: () => number,
  w: number,
  h: number,
  c: ChartColors,
) => {
  // small multi-colour wave icon + caption
  const n = 6;
  const cols = [c.red, c.yellow, c.blue];
  cols.forEach((col, k) => {
    const s = smoothSeries(r, n, 0.2, 0.8);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.6);
    s.forEach((v, i) => ctx.lineTo((i / (n - 1)) * w * 0.3, h * (0.6 - v * 0.4 + k * 0.05)));
    ctx.lineTo(w * 0.3, h * 0.6);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.9;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = c.ink;
  ctx.font = `300 ${Math.round(h * 0.3)}px ${FONT_FAMILY}`;
  ctx.fillText(fmtNumber(r), w * 0.36, h * 0.62);
};

const drawTable = (
  ctx: CanvasRenderingContext2D,
  r: () => number,
  w: number,
  h: number,
  c: ChartColors,
) => {
  const rows = 4 + Math.floor(r() * 3);
  ctx.font = `300 ${Math.round(h / rows / 2.2)}px ${FONT_FAMILY}`;
  for (let i = 0; i < rows; i++) {
    const y = ((i + 0.75) / rows) * h;
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = c.inkLight;
    ctx.fillText(fmtNumber(r), 0, y);
    ctx.fillText(fmtNumber(r), w * 0.36, y);
    if (r() < 0.7) ctx.fillText(fmtNumber(r), w * 0.7, y);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, y + h * 0.02, w, Math.max(2, h * 0.004));
  }
  ctx.globalAlpha = 1;
};

/** Builds the sprite atlas; returns canvas + sprite table. */
export const buildChartAtlas = (colors: ChartColors, seed = 2024) => {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
  const r = rng(seed);
  const sprites: Sprite[] = [];
  let idx = 0;
  for (const [kind, count] of KIND_PLAN) {
    for (let k = 0; k < count; k++) {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      if (row >= ROWS) break;
      idx++;
      const x0 = col * CW + PAD;
      const y0 = row * CH + PAD;
      const square = kind === "pie" || kind === "donut";
      const w = square ? CH - PAD * 2 : CW - PAD * 2;
      const h = CH - PAD * 2;
      ctx.save();
      ctx.translate(x0, y0);
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      switch (kind) {
        case "area":
          drawArea(ctx, r, w, h, colors);
          break;
        case "bars":
          drawBars(ctx, r, w, h, colors);
          break;
        case "teal":
          drawTeal(ctx, r, w, h, colors);
          break;
        case "pie":
          drawPie(ctx, r, w, colors);
          break;
        case "donut":
          drawDonut(ctx, r, w, colors);
          break;
        case "line":
          drawLine(ctx, r, w, h, colors);
          break;
        case "mini":
          drawMini(ctx, r, w, h, colors);
          break;
        case "table":
          drawTable(ctx, r, w, h, colors);
          break;
      }
      ctx.restore();
      // UV rect with a half-padding margin so blur taps fade to transparent
      const m = PAD * 0.5;
      const u0 = (x0 - m) / ATLAS_W;
      const u1 = (x0 + w + m) / ATLAS_W;
      const v1 = 1 - (y0 - m) / ATLAS_H;
      const v0 = 1 - (y0 + h + m) / ATLAS_H;
      sprites.push({ kind, uv: [u0, v0, u1, v1], aspect: (w + 2 * m) / (h + 2 * m) });
    }
  }
  return { canvas, sprites };
};

/** Glyph atlas: "0123456789,.-+% " in fixed-width cells. */
export const GLYPHS = "0123456789,.-+% ";
export const GLYPH_CELL_W = 128;
export const GLYPH_CELL_H = 192;

export const buildGlyphAtlas = () => {
  const canvas = document.createElement("canvas");
  canvas.width = GLYPH_CELL_W * GLYPHS.length;
  canvas.height = GLYPH_CELL_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `300 ${Math.round(GLYPH_CELL_H * 0.72)}px ${FONT_FAMILY}`;
  for (let i = 0; i < GLYPHS.length; i++) {
    ctx.fillText(GLYPHS[i], i * GLYPH_CELL_W + GLYPH_CELL_W / 2, GLYPH_CELL_H * 0.8);
  }
  return canvas;
};

/** Horizontal advance (in em units of glyph height) for layout. */
export const glyphAdvance = (ch: string) => {
  if (ch === "," || ch === ".") return 0.22;
  if (ch === " ") return 0.2;
  if (ch === "-") return 0.36;
  if (ch === "+") return 0.5;
  if (ch === "%") return 0.62;
  return 0.48; // digits
};
