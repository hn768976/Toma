import {alpha, shade, type Palette} from './palettes';
import type {Rect} from './types';

export const monoFont = (size: number, bold = false): string =>
  `${bold ? 'bold ' : ''}${Math.max(4, size).toFixed(2)}px "DejaVu Sans Mono", "Liberation Mono", "Courier New", monospace`;

export const insetRect = (r: Rect, by: number): Rect => ({
  x: r.x + by,
  y: r.y + by,
  w: Math.max(1, r.w - by * 2),
  h: Math.max(1, r.h - by * 2),
});

export const clipTo = (ctx: CanvasRenderingContext2D, r: Rect): void => {
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
};

/** Thin bordered frame, optionally with a faint interior wash. */
export const panelFrame = (
  ctx: CanvasRenderingContext2D,
  r: Rect,
  p: Palette,
  opts: {lineWidth?: number; borderAlpha?: number; wash?: number} = {},
): void => {
  const {lineWidth = 2.2, borderAlpha = 0.85, wash = 0.16} = opts;
  if (wash > 0) {
    ctx.fillStyle = shade(p.grid, 0.62, wash);
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = alpha(p.border, borderAlpha);
  ctx.strokeRect(r.x + lineWidth / 2, r.y + lineWidth / 2, r.w - lineWidth, r.h - lineWidth);
};

/**
 * The small filled tab that makes a rectangle read as an addressable object
 * rather than a text box. Carries a short, entirely fictional code string.
 */
export const labelTab = (
  ctx: CanvasRenderingContext2D,
  r: Rect,
  p: Palette,
  text: string,
  opts: {corner?: 'tl' | 'tr' | 'bl'; height?: number} = {},
): void => {
  const {corner = 'tl', height = Math.min(34, Math.max(14, r.h * 0.075))} = opts;
  const fontSize = height * 0.62;
  ctx.font = monoFont(fontSize);
  const w = Math.min(r.w * 0.62, ctx.measureText(text).width + height * 0.9);
  const x = corner === 'tr' ? r.x + r.w - w : r.x;
  const y = corner === 'bl' ? r.y + r.h - height : r.y;

  ctx.fillStyle = alpha(p.border, 0.55);
  ctx.fillRect(x, y, w, height);
  ctx.fillStyle = alpha(p.tones[2], 0.92);
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + height * 0.32, y + height * 0.56);
  ctx.textBaseline = 'alphabetic';
};

/** A small notch at one corner of a frame. */
export const cornerTab = (
  ctx: CanvasRenderingContext2D,
  r: Rect,
  p: Palette,
  corner: 'tl' | 'tr' | 'bl' | 'br',
  size: number,
): void => {
  const w = Math.min(size * 2.6, r.w * 0.3);
  const h = Math.min(size, r.h * 0.06);
  const x = corner === 'tr' || corner === 'br' ? r.x + r.w - w : r.x;
  const y = corner === 'bl' || corner === 'br' ? r.y + r.h - h : r.y;
  ctx.fillStyle = alpha(p.border, 0.7);
  ctx.fillRect(x, y, w, h);
};

/** Short tick marks along one edge of a panel. */
export const axisTicks = (
  ctx: CanvasRenderingContext2D,
  r: Rect,
  p: Palette,
  edge: 'bottom' | 'left' | 'top',
  count: number,
  len: number,
): void => {
  ctx.strokeStyle = alpha(p.tones[0], 0.85);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const long = i % 4 === 0;
    const l = long ? len : len * 0.55;
    if (edge === 'bottom') {
      const x = r.x + t * r.w;
      ctx.moveTo(x, r.y + r.h);
      ctx.lineTo(x, r.y + r.h - l);
    } else if (edge === 'top') {
      const x = r.x + t * r.w;
      ctx.moveTo(x, r.y);
      ctx.lineTo(x, r.y + l);
    } else {
      const y = r.y + t * r.h;
      ctx.moveTo(r.x, y);
      ctx.lineTo(r.x + l, y);
    }
  }
  ctx.stroke();
};

/** A faint internal grid, used behind line traces. */
export const faintGrid = (
  ctx: CanvasRenderingContext2D,
  r: Rect,
  p: Palette,
  cols: number,
  rows: number,
): void => {
  ctx.strokeStyle = shade(p.grid, 1.35, 0.5);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 1; i < cols; i++) {
    const x = r.x + (i / cols) * r.w;
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.h);
  }
  for (let i = 1; i < rows; i++) {
    const y = r.y + (i / rows) * r.h;
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
  }
  ctx.stroke();
};
