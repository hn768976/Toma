/** Shared canvas primitives. Kept here so every element rounds corners the same way. */

export const createBuffer = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
};

export const context2d = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable');
  }
  return ctx;
};

/**
 * Rounded-rectangle path. Written by hand rather than using ctx.roundRect so the
 * geometry is identical everywhere and the radius is always clamped to the box.
 */
export const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void => {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

/** A speech tail hanging off the bottom edge of a card or bubble. */
export const speechTailPath = (
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  width: number,
  height: number,
  direction: -1 | 1,
): void => {
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(baseX + width * direction, baseY);
  ctx.lineTo(baseX + width * 0.15 * direction, baseY + height);
  ctx.closePath();
};
