/**
 * Off-screen scratch canvases, kept between frames so the reduced-resolution
 * passes do not reallocate 8 megapixels of backing store thirty times a second.
 * Purely a cache: contents are always cleared before use.
 */

const cache = new Map<string, HTMLCanvasElement>();

export const getScratch = (key: string, width: number, height: number): HTMLCanvasElement => {
  const existing = cache.get(key);
  if (existing && existing.width === width && existing.height === height) {
    return existing;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  cache.set(key, canvas);
  return canvas;
};

export const clear2d = (
  canvas: HTMLCanvasElement,
  options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D => {
  const ctx = canvas.getContext("2d", options) as CanvasRenderingContext2D;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
};
