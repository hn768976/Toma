/**
 * Draws a small canvas up to a large one with the browser's best resampling.
 *
 * The shimmer is soft by nature, so computing it at 1/6 linear resolution and
 * upscaling costs a thirty-sixth of the pixel work and is visually
 * indistinguishable from the full-resolution field.
 */

export const lowResUpscale = (
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  const previousEnabled = ctx.imageSmoothingEnabled;
  const previousQuality = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, x, y, width, height);
  ctx.imageSmoothingEnabled = previousEnabled;
  ctx.imageSmoothingQuality = previousQuality;
};
