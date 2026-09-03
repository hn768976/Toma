/**
 * Small helpers for painting into a 2D canvas.
 */

export type Ctx = CanvasRenderingContext2D;

export const makeCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
};

export const context2d = (canvas: HTMLCanvasElement): Ctx => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return ctx;
};

/** Releases a canvas's backing store — 4K intermediates are expensive. */
export const releaseCanvas = (canvas: HTMLCanvasElement): void => {
  canvas.width = 0;
  canvas.height = 0;
};

/** `ctx.letterSpacing` is Chromium-only and missing from some DOM typings. */
export const setLetterSpacing = (ctx: Ctx, px: number): void => {
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
};

export const setBlur = (ctx: Ctx, px: number): void => {
  ctx.filter = px > 0.05 ? `blur(${px.toFixed(2)}px)` : "none";
};

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));
