import type { Variant } from "./variants";

export type Ctx2D = CanvasRenderingContext2D;

/**
 * Every draw call goes through a Painter. `ctx` is the full-resolution target;
 * `glow` is a half-resolution accumulation buffer that is blurred and
 * composited back at the end of the frame to produce bloom. Drawing into
 * `glow` uses the same coordinate space - the buffer carries a 0.5 scale.
 */
export type Painter = {
  ctx: Ctx2D;
  glow: Ctx2D;
};

/**
 * Draw the same thing into the main target and the bloom buffer. `glowScale`
 * controls how much of the element feeds the bloom - large bright fills (lit
 * countries, indicator blocks) need far less than small accents or the bloom
 * blows out.
 */
export const both = (p: Painter, fn: (c: Ctx2D) => void, glowScale = 1) => {
  fn(p.ctx);
  if (glowScale <= 0) return;
  p.glow.save();
  p.glow.globalAlpha = glowScale;
  fn(p.glow);
  p.glow.restore();
};

export type Fonts = { sans: string; mono: string };

export type DrawArgs = {
  p: Painter;
  v: Variant;
  fonts: Fonts;
  /** Already wrapped into 0..899. */
  frame: number;
  fps: number;
};

const hexCache = new Map<string, [number, number, number]>();

const parseHex = (hex: string): [number, number, number] => {
  const cached = hexCache.get(hex);
  if (cached) return cached;
  const n = parseInt(hex.slice(1), 16);
  const rgb: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  hexCache.set(hex, rgb);
  return rgb;
};

/** `#RRGGBB` -> `rgba(r,g,b,a)`. The only place colours are transformed. */
export const alpha = (hex: string, a: number) => {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};

/** Blend two palette colours. */
export const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(r1 + (r2 - r1) * k)},${Math.round(
    g1 + (g2 - g1) * k,
  )},${Math.round(b1 + (b2 - b1) * k)})`;
};

export const sans = (f: Fonts, size: number, weight = 600) =>
  `${weight} ${size}px "${f.sans}", "Arial Narrow", sans-serif`;

export const mono = (f: Fonts, size: number, weight = 500) =>
  `${weight} ${size}px "${f.mono}", monospace`;

/** Rectangle with the top-left and bottom-right corners cut off - the shared
 *  panel silhouette. */
export const clippedRectPath = (
  c: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut: number,
) => {
  const k = Math.min(cut, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + k, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w, y + h - k);
  c.lineTo(x + w - k, y + h);
  c.lineTo(x, y + h);
  c.lineTo(x, y + k);
  c.closePath();
};

export const roundRectPath = (
  c: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) => {
  const k = Math.min(radius, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + k, y);
  c.arcTo(x + w, y, x + w, y + h, k);
  c.arcTo(x + w, y + h, x, y + h, k);
  c.arcTo(x, y + h, x, y, k);
  c.arcTo(x, y, x + w, y, k);
  c.closePath();
};

export const line = (c: Ctx2D, x1: number, y1: number, x2: number, y2: number) => {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
};

/** Letter-spaced text. Chrome supports ctx.letterSpacing; guard for safety. */
export const tracked = (
  c: Ctx2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) => {
  const anyCtx = c as Ctx2D & { letterSpacing?: string };
  const prev = anyCtx.letterSpacing;
  if (prev !== undefined) anyCtx.letterSpacing = `${spacing}px`;
  c.fillText(text, x, y);
  if (prev !== undefined) anyCtx.letterSpacing = prev;
};

/** Small L-shaped tick used at panel corners. */
export const cornerTick = (
  c: Ctx2D,
  x: number,
  y: number,
  len: number,
  dx: number,
  dy: number,
) => {
  c.beginPath();
  c.moveTo(x + dx * len, y);
  c.lineTo(x, y);
  c.lineTo(x, y + dy * len);
  c.stroke();
};

export const clampedLerp = (a: number, b: number, t: number) =>
  a + (b - a) * Math.max(0, Math.min(1, t));
