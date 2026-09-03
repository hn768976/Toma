/**
 * Screen-space bloom, composited back over the source.
 *
 * The frame is drawn into a much smaller scratch canvas through a
 * brightness/contrast/blur filter chain. The contrast step is doing the job a
 * luminance threshold would do in a shader pipeline: it crushes the midtones
 * away so that only genuinely bright pixels survive to be blurred and added
 * back. Downsampling first is what makes a wide, soft bloom affordable — a
 * blur radius of 12px at one-sixth scale reads as ~72px at full size.
 */
import { scratchContext } from "./scratchCanvas";

export type BloomOptions = {
  /** Scratch resolution as a fraction of the source. Smaller = softer, cheaper. */
  scale?: number;
  /** Blur radius applied at scratch resolution, in scratch pixels. */
  blur?: number;
  /** Gain applied before thresholding. */
  brightness?: number;
  /** Threshold hardness: higher keeps only brighter pixels. */
  contrast?: number;
  /** Strength of the additive result. */
  alpha?: number;
};

export const bloomPass = (
  ctx: CanvasRenderingContext2D,
  options: BloomOptions = {},
): void => {
  const {
    scale = 0.16,
    blur = 9,
    brightness = 1.35,
    contrast = 2.6,
    alpha = 0.75,
  } = options;

  const source = ctx.canvas;
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const small = scratchContext("bloom", w, h);

  small.save();
  small.setTransform(1, 0, 0, 1, 0, 0);
  small.globalCompositeOperation = "copy";
  small.filter = `brightness(${brightness}) contrast(${contrast}) blur(${blur}px)`;
  small.drawImage(source, 0, 0, w, h);
  small.restore();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small.canvas, 0, 0, source.width, source.height);
  ctx.restore();
};
