/**
 * bloomPass.ts — glow by stacking a blurred copy under a sharp one.
 *
 * WHAT IT DOES
 *   Renders your draw callback into a buffer, composites a blurred copy
 *   of it additively, then draws the sharp copy on top.
 *
 * WHAT IT IS FOR
 *   The halo around anything that is meant to be emitting light rather
 *   than reflecting it: neon, particles, hot cores, screens. Without it,
 *   a bright shape on a dark ground reads as a bright *sticker* — real
 *   emissive sources scatter in the lens and in the air.
 *
 * HOW IT DIFFERS FROM A BIG SOFT SHADOW
 *   Additive compositing. Where two glows overlap they SUM and clip
 *   toward white, which is what light does. A shadow or a semi-
 *   transparent copy composites with alpha, so overlaps stay the same
 *   brightness and the result looks flat and slightly dirty.
 *
 * PARAMETERS
 *   ctx          destination 2D context
 *   width,       buffer size in px — match the composition
 *   height
 *   draw         `(ctx) => void`, called once. Draw the emissive content.
 *   blurPx       glow radius. Default 19.
 *   strength     0..1 opacity of the glow layer. Default 0.85.
 *   blendMode    how the glow lands. Default "lighter" (true additive).
 *                "screen" is gentler and will not clip to white as fast.
 *   drawSharp    whether to draw the unblurred copy on top. Default true.
 *                Set false to get glow only — useful as the atmospheric
 *                pass under a neonStroke.
 *   threshold    0..1 luminance below which pixels do not bloom. Default
 *                0 (everything blooms), which is right for additive
 *                particle art on a dark ground. On a bright scene, 0 will
 *                bloom the entire image into mush and you want ~0.6.
 *                NOTE: any value above 0 triggers a full-frame ImageData
 *                pass, which is ~8.3M pixel reads at 4K — measurably
 *                slow. Prefer restructuring so only emissive things go
 *                through bloomPass at all.
 *   createCanvas injectable canvas factory, as in threeBufferDOF.
 *
 * SCALING GOTCHA
 *   blurPx is in device pixels and does not survive a resolution change.
 *   Multiply it by your resolution scale, or the 4K render will have a
 *   glow half the apparent size of the 1080p one.
 *
 * USAGE
 *   bloomPass({ ctx, width, height, blurPx: 19,
 *               draw: (c) => particles.forEach((p) => dot(c, p)) });
 */

import type { CanvasFactory, DrawFn } from "./threeBufferDOF";

const defaultCreateCanvas: CanvasFactory = (width, height) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export type BloomPassOptions = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  draw: DrawFn;
  blurPx?: number;
  strength?: number;
  blendMode?: GlobalCompositeOperation;
  drawSharp?: boolean;
  threshold?: number;
  createCanvas?: CanvasFactory;
};

/**
 * Zeroes the alpha of every pixel dimmer than `threshold`, so only the
 * bright parts of the buffer contribute to the glow. Rec. 709 luma.
 */
const applyLuminanceThreshold = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  threshold: number,
): void => {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const cutoff = threshold * 255;
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (luma < cutoff) data[i + 3] = 0;
  }
  ctx.putImageData(image, 0, 0);
};

export const bloomPass = ({
  ctx,
  width,
  height,
  draw,
  blurPx = 19,
  strength = 0.85,
  blendMode = "lighter",
  drawSharp = true,
  threshold = 0,
  createCanvas = defaultCreateCanvas,
}: BloomPassOptions): void => {
  const buffer = createCanvas(width, height);
  const bufferCtx = buffer?.getContext("2d");
  if (!buffer || !bufferCtx) return;

  draw(bufferCtx);

  const previousAlpha = ctx.globalAlpha;
  const previousOp = ctx.globalCompositeOperation;
  const previousFilter = ctx.filter;

  if (threshold > 0) {
    // Threshold a COPY, so the sharp pass below still has every pixel.
    const bright = createCanvas(width, height);
    const brightCtx = bright?.getContext("2d");
    if (bright && brightCtx) {
      brightCtx.drawImage(buffer, 0, 0);
      applyLuminanceThreshold(brightCtx, width, height, threshold);
      ctx.globalAlpha = strength;
      ctx.globalCompositeOperation = blendMode;
      ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";
      ctx.drawImage(bright, 0, 0);
    }
  } else {
    ctx.globalAlpha = strength;
    ctx.globalCompositeOperation = blendMode;
    ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";
    ctx.drawImage(buffer, 0, 0);
  }

  if (drawSharp) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = blendMode;
    ctx.filter = "none";
    ctx.drawImage(buffer, 0, 0);
  }

  ctx.globalAlpha = previousAlpha;
  ctx.globalCompositeOperation = previousOp;
  ctx.filter = previousFilter;
};
