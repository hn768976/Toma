import {random} from 'remotion';

export const clamp = (v: number, lo = 0, hi = 1): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const easeInOutSine = (t: number): number =>
  -(Math.cos(Math.PI * t) - 1) / 2;

/** Sharp, no-overshoot ramp used by the "breach" assembly — bands snap in. */
export const easeOutExpo = (t: number): number =>
  t >= 1 ? 1 : 1 - Math.pow(2, -9 * t);

/** Ease-out with a slight overshoot past 1 before settling. */
export const backOut = (t: number, amount: number): number => {
  const c3 = amount + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + amount * Math.pow(t - 1, 2);
};

/** Deterministic float in [lo, hi) from a stable string seed. */
export const rnd = (seed: string, lo = 0, hi = 1): number =>
  lo + random(seed) * (hi - lo);

/** Deterministic integer in [lo, hi] inclusive — never overshoots `hi`. */
export const rndInt = (seed: string, lo: number, hi: number): number =>
  Math.min(hi, lo + Math.floor(random(seed) * (hi - lo + 1)));

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

export const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Blend a hex colour toward another hex colour. */
export const mixHex = (a: string, b: string, t: number): string => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const to = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${to(lerp(r1, r2, t))}${to(lerp(g1, g2, t))}${to(lerp(b1, b2, t))}`;
};

export const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

export const context2d = (c: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return ctx;
};

export const clearCanvas = (ctx: CanvasRenderingContext2D): void => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.setLineDash([]);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
};

/** Shrink `base` until `text` fits inside `maxWidth`. */
export const fitFontSize = (
  ctx: CanvasRenderingContext2D,
  text: string,
  fontOf: (size: number) => string,
  base: number,
  maxWidth: number
): number => {
  let size = base;
  for (let i = 0; i < 40; i++) {
    ctx.font = fontOf(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size *= 0.97;
  }
  return size;
};
