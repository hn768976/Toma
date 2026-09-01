// Additive bloom pass. Blurring 3840x2160 per frame is far too slow, so
// the source is downscaled to a quarter, blurred there, squared against
// itself so the pass favours the brightest pixels, and scaled back up.

import { BLOOM_BLUR, BLOOM_DOWNSCALE, BLOOM_STRENGTH } from "./config";
import { createCanvas } from "./canvas";

export type BloomBuffers = {
  blur: HTMLCanvasElement;
  square: HTMLCanvasElement;
};

export const createBloomBuffers = (
  width: number,
  height: number,
): BloomBuffers | null => {
  const w = Math.max(1, Math.round(width * BLOOM_DOWNSCALE));
  const h = Math.max(1, Math.round(height * BLOOM_DOWNSCALE));
  const blur = createCanvas(w, h);
  const square = createCanvas(w, h);
  if (!blur || !square) return null;
  return { blur, square };
};

export const applyBloom = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  buffers: BloomBuffers,
  strength = BLOOM_STRENGTH,
) => {
  const blurCtx = buffers.blur.getContext("2d");
  const squareCtx = buffers.square.getContext("2d");
  if (!blurCtx || !squareCtx) return;

  const { width: bw, height: bh } = buffers.blur;

  blurCtx.setTransform(1, 0, 0, 1, 0, 0);
  blurCtx.globalCompositeOperation = "copy";
  blurCtx.filter = `blur(${BLOOM_BLUR}px)`;
  blurCtx.drawImage(source, 0, 0, bw, bh);
  blurCtx.filter = "none";
  blurCtx.globalCompositeOperation = "source-over";

  // Multiplying the blurred buffer by itself squares every channel, which
  // pushes dim haze toward nothing and leaves the highlights standing.
  squareCtx.setTransform(1, 0, 0, 1, 0, 0);
  squareCtx.globalCompositeOperation = "copy";
  squareCtx.drawImage(buffers.blur, 0, 0);
  squareCtx.globalCompositeOperation = "multiply";
  squareCtx.drawImage(buffers.blur, 0, 0);
  squareCtx.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = strength;
  ctx.drawImage(buffers.square, 0, 0, source.width, source.height);
  ctx.restore();
};
