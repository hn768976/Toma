/**
 * lowResUpscale.ts — compute a soft layer small, then scale it up.
 *
 * WHAT IT DOES
 *   Runs your draw callback into a buffer at 1/divisor resolution, then
 *   draws that buffer back up to full size with smoothing on.
 *
 * WHAT IT IS FOR
 *   Any layer whose highest spatial frequency is already lower than the
 *   output resolution — atmospheric gradients, god rays, fog, dust
 *   haze, large soft glows. At 1/8 resolution the layer costs 1/64 the
 *   fill rate, and because the content has no fine detail, the upscale
 *   is visually free. On a big gradient this is the single largest render
 *   win available.
 *
 * WHEN IT IS WRONG — READ THIS BEFORE USING IT
 *   Anything with detail at or near pixel scale. Particles are the
 *   classic mistake: a 1px dot drawn into a 1/8 buffer either lands in a
 *   cell and becomes an 8px blob, or falls between samples and vanishes
 *   entirely — and which of the two happens changes frame to frame as it
 *   moves, so the field flickers. The same applies to text, thin strokes,
 *   and hard edges. If you can name an edge in the layer, do not use this.
 *
 * PARAMETERS
 *   ctx           destination 2D context
 *   width,        FULL composition size in px
 *   height
 *   draw          `(ctx) => void`. Receives a context already scaled so
 *                 you draw in FULL composition coordinates — a circle at
 *                 (960, 540) lands centre-frame whatever the divisor is.
 *   divisor       how much smaller the buffer is. Default 8. Must be >= 1.
 *                 4 is safer for anything with a visible falloff edge;
 *                 16 is fine for a flat colour wash.
 *   opacity       0..1 for the composite. Default 1.
 *   blendMode     Default "source-over". "lighter" for additive haze.
 *   smoothing     bilinear filtering on upscale. Default true. Setting it
 *                 false gives deliberate chunky pixels, which is a look,
 *                 not a correctness fix.
 *   createCanvas  injectable canvas factory, as in threeBufferDOF.
 *
 * GOTCHA
 *   Line widths, blur radii and font sizes inside `draw` are in full
 *   composition units because the context is pre-scaled — but they are
 *   RASTERISED at buffer resolution. A 1px line in an /8 buffer is an
 *   eighth of a pixel and will simply not appear. Do not put strokes in
 *   here.
 *
 * USAGE
 *   lowResUpscale({
 *     ctx, width, height, divisor: 8,
 *     draw: (c) => {
 *       const g = c.createRadialGradient(960, 300, 0, 960, 300, 700);
 *       g.addColorStop(0, haloColor);
 *       g.addColorStop(1, "transparent");
 *       c.fillStyle = g;
 *       c.fillRect(0, 0, 1920, 1080);
 *     },
 *   });
 */

import type { CanvasFactory, DrawFn } from "./threeBufferDOF";

const defaultCreateCanvas: CanvasFactory = (width, height) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export type LowResUpscaleOptions = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  draw: DrawFn;
  divisor?: number;
  opacity?: number;
  blendMode?: GlobalCompositeOperation;
  smoothing?: boolean;
  createCanvas?: CanvasFactory;
};

export const lowResUpscale = ({
  ctx,
  width,
  height,
  draw,
  divisor = 8,
  opacity = 1,
  blendMode = "source-over",
  smoothing = true,
  createCanvas = defaultCreateCanvas,
}: LowResUpscaleOptions): void => {
  const d = Math.max(1, divisor);
  // Ceil so the buffer never falls short of the frame and leaves an
  // unpainted strip on the right/bottom edge.
  const bufferWidth = Math.max(1, Math.ceil(width / d));
  const bufferHeight = Math.max(1, Math.ceil(height / d));

  const buffer = createCanvas(bufferWidth, bufferHeight);
  const bufferCtx = buffer?.getContext("2d");
  if (!buffer || !bufferCtx) return;

  // Pre-scale so the callback works in full composition coordinates.
  bufferCtx.scale(bufferWidth / width, bufferHeight / height);
  draw(bufferCtx);

  const previousAlpha = ctx.globalAlpha;
  const previousOp = ctx.globalCompositeOperation;
  const previousSmoothing = ctx.imageSmoothingEnabled;

  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = blendMode;
  ctx.imageSmoothingEnabled = smoothing;
  ctx.drawImage(buffer, 0, 0, width, height);

  ctx.globalAlpha = previousAlpha;
  ctx.globalCompositeOperation = previousOp;
  ctx.imageSmoothingEnabled = previousSmoothing;
};
