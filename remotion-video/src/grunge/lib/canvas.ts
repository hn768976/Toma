/**
 * Small canvas utilities shared by the layers.
 */

/** Creates a detached canvas, or null during SSR (Remotion evaluates the
 *  component tree on the server when it collects compositions). */
export const createCanvas = (width: number, height: number): HTMLCanvasElement | null => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

/**
 * Blits a small source canvas up to `width`x`height` with the browser's best
 * resampling. This is how the blotch and vignette layers get their softness:
 * they are computed at 1/8 (or smaller) resolution and the upscale itself is
 * most of the blur.
 */
export const drawUpscaled = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
): void => {
  const previous = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  ctx.imageSmoothingEnabled = previous;
};

/** Clears a canvas back to fully transparent. */
export const clear = (ctx: CanvasRenderingContext2D, width: number, height: number): void => {
  ctx.clearRect(0, 0, width, height);
};

/** Smoothstep, used all over for soft envelopes. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const clamp = (x: number, min: number, max: number): number =>
  x < min ? min : x > max ? max : x;
