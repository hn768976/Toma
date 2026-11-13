import { mulberry32, range, Rng } from "./random";

// A procedurally drawn texture atlas of "printed data" panels: pseudo-text
// columns, dense data blocks, cross-hair markers and tiny charts. The marks are
// drawn as white-on-transparent alpha so the shader can tint them per palette.
// Everything is vector-drawn (no fonts), so output is identical on every machine.

export const ATLAS_SIZE = 4096;
export const ATLAS_GRID = 6; // 6 x 6 = 36 panel variants
export const CELL = ATLAS_SIZE / ATLAS_GRID;

const drawGlyph = (
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  // A glyph = an x-height body plus an optional ascender/descender stroke.
  // Rows of these read as lines of tiny monospaced text.
  const t = Math.max(2, w * 0.24);
  const xh = h * 0.5;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(x, y + h - xh, w, t);
  ctx.fillRect(x, y + h - t, w, t);
  if (rng() < 0.6) {
    ctx.fillRect(x + (rng() < 0.5 ? 0 : w - t), y + h - xh, t, xh);
  }
  const extra = rng();
  if (extra < 0.3) {
    ctx.fillRect(x + rng() * (w - t), y, t, h); // ascender
  } else if (extra < 0.4) {
    ctx.fillRect(x + rng() * (w - t), y + h - t, t, h * 0.35); // descender
  }
  ctx.globalAlpha = 1;
};

const drawTextLine = (
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  x: number,
  y: number,
  maxW: number,
  charW: number,
  charH: number,
) => {
  let cx = x;
  const end = x + maxW;
  while (cx < end - charW * 2) {
    const wordLen = 2 + Math.floor(rng() * 8);
    for (let i = 0; i < wordLen && cx < end; i++) {
      drawGlyph(ctx, rng, cx, y, charW * 0.78, charH);
      cx += charW;
    }
    cx += charW * range(rng, 0.8, 2.2);
  }
};

const drawCross = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  t: number,
) => {
  ctx.fillRect(x - size / 2, y - t / 2, size, t);
  ctx.fillRect(x - t / 2, y - size / 2, t, size);
};

const drawPanel = (
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  ox: number,
  oy: number,
  size: number,
) => {
  const pad = size * 0.07;
  const charW = size * range(rng, 0.0065, 0.0105);
  const charH = charW * 1.35;
  const lineGap = charH * range(rng, 1.5, 2.0);

  // 1–3 blocks of text per panel, placed like notes on a schematic.
  const blocks = 1 + Math.floor(rng() * 4);
  for (let b = 0; b < blocks; b++) {
    const bw = size * range(rng, 0.28, 0.7);
    const bx = ox + pad + rng() * (size - 2 * pad - bw);
    const lines = 5 + Math.floor(rng() * 20);
    const bh = lines * lineGap;
    const by = oy + pad + rng() * Math.max(1, size - 2 * pad - bh);
    const dense = rng() < 0.18;
    ctx.globalAlpha = range(rng, 0.65, 1);
    for (let l = 0; l < lines; l++) {
      const indent = rng() < 0.3 ? charW * 2 * Math.floor(1 + rng() * 3) : 0;
      const lw = (bw - indent) * (dense ? range(rng, 0.85, 1) : range(rng, 0.3, 1));
      if (dense) {
        // solid data bars (the dark "≡" blocks of the reference)
        ctx.fillRect(bx + indent, by + l * lineGap * 0.5, lw, charH * 0.28);
      } else {
        drawTextLine(ctx, rng, bx + indent, by + l * lineGap, lw, charW, charH);
      }
    }
  }

  // Cross-hair markers and dots.
  ctx.globalAlpha = 1;
  const crosses = Math.floor(rng() * 5);
  for (let i = 0; i < crosses; i++) {
    drawCross(
      ctx,
      ox + pad + rng() * (size - 2 * pad),
      oy + pad + rng() * (size - 2 * pad),
      size * range(rng, 0.018, 0.03),
      Math.max(2, size * 0.0035),
    );
  }
  const dots = Math.floor(rng() * 6);
  for (let i = 0; i < dots; i++) {
    const r = size * range(rng, 0.003, 0.006);
    ctx.beginPath();
    ctx.arc(
      ox + pad + rng() * (size - 2 * pad),
      oy + pad + rng() * (size - 2 * pad),
      r,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Occasionally a tiny bar chart or an inset frame.
  if (rng() < 0.35) {
    const cw = size * range(rng, 0.12, 0.22);
    const ch = cw * range(rng, 0.4, 0.8);
    const cx = ox + pad + rng() * (size - 2 * pad - cw);
    const cy = oy + pad + rng() * (size - 2 * pad - ch);
    const bars = 5 + Math.floor(rng() * 8);
    const bwid = cw / bars;
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < bars; i++) {
      const bh = ch * range(rng, 0.15, 1);
      ctx.fillRect(cx + i * bwid, cy + ch - bh, bwid * 0.6, bh);
    }
  }
  if (rng() < 0.3) {
    const fw = size * range(rng, 0.15, 0.35);
    const fh = fw * range(rng, 0.4, 1);
    const t = Math.max(2, size * 0.003);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = "white";
    ctx.lineWidth = t;
    ctx.strokeRect(
      ox + pad + rng() * (size - 2 * pad - fw),
      oy + pad + rng() * (size - 2 * pad - fh),
      fw,
      fh,
    );
  }
  ctx.globalAlpha = 1;
};

export const createDataAtlas = (seed: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas not available");
  }
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  ctx.fillStyle = "white";
  const rng = mulberry32(seed);
  for (let gy = 0; gy < ATLAS_GRID; gy++) {
    for (let gx = 0; gx < ATLAS_GRID; gx++) {
      drawPanel(ctx, rng, gx * CELL, gy * CELL, CELL);
    }
  }
  return canvas;
};

export const createBackground = (
  colors: [string, string, string],
  hotspot: [number, number],
): HTMLCanvasElement => {
  const w = 1920;
  const h = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas not available");
  }
  const g = ctx.createRadialGradient(
    hotspot[0] * w,
    hotspot[1] * h,
    0,
    hotspot[0] * w,
    hotspot[1] * h,
    w * 0.62,
  );
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.42, colors[1]);
  g.addColorStop(1, colors[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Fine noise dither avoids banding in the smooth gradient after encoding.
  const img = ctx.getImageData(0, 0, w, h);
  const rng = mulberry32(99);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng() - 0.5) * 3;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};
