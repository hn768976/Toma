import {BORDER} from './layout';
import {rgb, rgba} from './color';
import type {RGB} from './color';
import {condFont, monoFont} from './fonts';
import type {Palette} from '../variants';

export const HEADER = 50;

export type Pal = {
  line: RGB;
  fill: RGB;
  text: RGB;
  particle: RGB;
  hot: RGB;
  accent: RGB;
  sweep: RGB;
};

export const toPal = (p: Palette): Pal => ({
  line: rgb(p.line),
  fill: rgb(p.fill),
  text: rgb(p.text),
  particle: rgb(p.particle),
  hot: rgb(p.particleHot),
  accent: rgb(p.accent),
  sweep: rgb(p.sweep),
});

export const offscreen = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

export const hline = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  c: RGB,
  a = 1,
  t = BORDER,
) => {
  ctx.fillStyle = rgba(c, a);
  ctx.fillRect(x, y, w, t);
};

export const vline = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  c: RGB,
  a = 1,
  t = BORDER,
) => {
  ctx.fillStyle = rgba(c, a);
  ctx.fillRect(x, y, t, h);
};

/** Thin bracket corners, the signature of the frame. */
export const brackets = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  len: number,
  c: RGB,
  a = 1,
  t = BORDER,
) => {
  ctx.fillStyle = rgba(c, a);
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.fillRect(sx > 0 ? cx : cx - len, sy > 0 ? cy : cy - t, len, t);
    ctx.fillRect(sx > 0 ? cx : cx - t, sy > 0 ? cy : cy - len, t, len);
  }
};

export const setLetterSpacing = (ctx: CanvasRenderingContext2D, v: string) => {
  const c = ctx as CanvasRenderingContext2D & {letterSpacing?: string};
  if ('letterSpacing' in c) c.letterSpacing = v;
};

/**
 * Standard panel shell: fill, hairline border, corner ticks and a header with
 * the block's label. Drawn once per block into an offscreen canvas.
 */
export const panelShell = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: Pal,
  label: string,
  sub?: string,
): number => {
  ctx.fillStyle = rgba(p.fill, 0.86);
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = rgba(p.line, 0.9);
  ctx.fillRect(0, 0, w, BORDER);
  ctx.fillRect(0, h - BORDER, w, BORDER);
  ctx.fillRect(0, 0, BORDER, h);
  ctx.fillRect(w - BORDER, 0, BORDER, h);

  brackets(ctx, 0, 0, w, h, 26, p.accent, 0.95, BORDER + 1);

  // header
  ctx.fillStyle = rgba(p.line, 0.34);
  ctx.fillRect(BORDER, BORDER, w - BORDER * 2, HEADER - BORDER);
  hline(ctx, 0, HEADER, w, p.line, 0.75);

  ctx.fillStyle = rgba(p.accent, 0.95);
  ctx.fillRect(14, 14, 6, HEADER - 28);

  setLetterSpacing(ctx, '2.5px');
  ctx.font = condFont(28, 600);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(p.text, 0.92);
  ctx.fillText(label, 30, HEADER / 2 + 1);

  if (sub) {
    setLetterSpacing(ctx, '1px');
    ctx.font = monoFont(19);
    ctx.fillStyle = rgba(p.text, 0.45);
    ctx.textAlign = 'right';
    ctx.fillText(sub, w - 16, HEADER / 2 + 1);
    ctx.textAlign = 'left';
  }
  setLetterSpacing(ctx, '0px');
  return HEADER;
};
