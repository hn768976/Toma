/**
 * Additive bloom over whatever is already on the canvas.
 *
 * The composite is downscaled, everything below `threshold` luminance is
 * discarded, and what remains is blurred at two radii and added back. Working
 * at a fraction of full resolution is what makes a wide, generous bloom
 * affordable at 4K — a blur that reads as 100px on the finished frame costs a
 * 25px blur on a quarter-scale buffer.
 */

import { createLayer } from "./canvas";

export interface BloomOptions {
  /** Luminance, 0-1, below which a pixel contributes nothing. */
  threshold: number;
  /** Blur radii in downscaled pixels, each added back in turn. */
  radii: number[];
  /** Opacity of each blurred copy, matched to `radii`. */
  strengths: number[];
  /** Linear downscale factor for the working buffer. */
  scale: number;
}

export interface BloomBuffers {
  bright: HTMLCanvasElement;
  brightCtx: CanvasRenderingContext2D;
  blur: HTMLCanvasElement;
  blurCtx: CanvasRenderingContext2D;
}

export const createBloomBuffers = (
  width: number,
  height: number,
  scale: number,
): BloomBuffers => {
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const bright = createLayer(w, h);
  const blur = createLayer(w, h);
  return {
    bright: bright.canvas,
    brightCtx: bright.ctx,
    blur: blur.canvas,
    blurCtx: blur.ctx,
  };
};

export const bloomPass = (
  ctx: CanvasRenderingContext2D,
  buffers: BloomBuffers,
  options: BloomOptions,
): void => {
  const { bright, brightCtx, blur, blurCtx } = buffers;
  const w = bright.width;
  const h = bright.height;

  brightCtx.setTransform(1, 0, 0, 1, 0, 0);
  brightCtx.globalCompositeOperation = "source-over";
  brightCtx.globalAlpha = 1;
  brightCtx.filter = "none";
  brightCtx.clearRect(0, 0, w, h);
  brightCtx.imageSmoothingEnabled = true;
  brightCtx.imageSmoothingQuality = "high";
  brightCtx.drawImage(ctx.canvas, 0, 0, w, h);

  const image = brightCtx.getImageData(0, 0, w, h);
  const { data } = image;
  const threshold = options.threshold;
  const span = 1 - threshold || 1;
  for (let i = 0; i < data.length; i += 4) {
    const luma = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
    const excess = (luma - threshold) / span;
    if (excess <= 0) {
      data[i + 3] = 0;
      continue;
    }
    const gain = excess > 1 ? 1 : excess;
    data[i] *= gain;
    data[i + 1] *= gain;
    data[i + 2] *= gain;
  }
  brightCtx.putImageData(image, 0, 0);

  const inverseScale = ctx.canvas.width / w;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < options.radii.length; i++) {
    blurCtx.setTransform(1, 0, 0, 1, 0, 0);
    blurCtx.globalCompositeOperation = "source-over";
    blurCtx.globalAlpha = 1;
    blurCtx.filter = "none";
    blurCtx.clearRect(0, 0, w, h);
    blurCtx.filter = `blur(${options.radii[i]}px)`;
    blurCtx.drawImage(bright, 0, 0);
    blurCtx.filter = "none";

    ctx.globalAlpha = options.strengths[i];
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(blur, 0, 0, w * inverseScale, h * inverseScale);
  }
  ctx.restore();
};
