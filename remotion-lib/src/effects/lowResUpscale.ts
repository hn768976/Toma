/**
 * lowResUpscale — compute a soft layer small, then scale it up.
 *
 * WHAT: Gives you a context at 1/N of the frame size, and composites it back
 * scaled up with smoothing on.
 *
 * WHY: a gradient, a haze, a dust cloud or a heavy blur carries no detail above
 * a few hundred pixels. Computing it at full 4K resolution costs 64x the pixels
 * for output that is identical once it is blurred. Every source project that
 * had a soft background layer arrived at this independently.
 *
 * CORRECT FOR: gradients, dust, fog, nebulae, glows, anything you were going to
 * blur heavily anyway, vignettes.
 *
 * WRONG FOR: particles, text, line art, anything with a hard edge. Upscaling
 * quantises positions to the low-res grid, so particles visibly snap between
 * frames and thin lines alias into dashes. If you can see an edge, do not use
 * this. This is the single most common way the technique gets misapplied.
 *
 * PARAMETERS (createLowResLayer)
 *   width, height  FRAME size. The buffer is this divided by `scale`.
 *   scale          Divisor. Default 8. Values above ~12 start to show banding
 *                  in gradients.
 *
 * PARAMETERS (compositeLowRes)
 *   ctx        Destination, frame-sized.
 *   layer      From `createLowResLayer`.
 *   opacity    Default 1.
 *   composite  Default 'source-over'. 'lighter' for glows.
 *   smoothing  Default true. Setting false gives you deliberate chunky pixels.
 *
 * GOTCHA: the layer's context is pre-scaled, so you draw in FRAME coordinates
 * and the division is handled for you. A circle at (960, 540) radius 200 lands
 * where you expect.
 *
 * GOTCHA: allocate once per resolution, clear per frame — same rule as the DOF
 * buffers.
 *
 * EXAMPLE
 *   const layer = useMemo(() => createLowResLayer({ width, height }), [width, height]);
 *   clearLowResLayer(layer);
 *   layer.ctx.fillStyle = grad;
 *   layer.ctx.fillRect(0, 0, width, height);
 *   compositeLowRes({ ctx, layer, composite: 'lighter' });
 */
import type { Ctx } from '../types';

export type LowResLayer = {
  canvas: HTMLCanvasElement;
  /** Pre-scaled: draw in frame coordinates. */
  ctx: Ctx;
  width: number;
  height: number;
  scale: number;
};

export type CreateLowResLayerOptions = {
  width: number;
  height: number;
  scale?: number;
};

export const createLowResLayer = ({
  width,
  height,
  scale = 8,
}: CreateLowResLayerOptions): LowResLayer => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width / scale));
  canvas.height = Math.max(1, Math.round(height / scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable for a low-res layer');
  // Pre-scale so callers work in frame coordinates throughout.
  ctx.scale(canvas.width / width, canvas.height / height);

  return { canvas, ctx, width, height, scale };
};

export const clearLowResLayer = (layer: LowResLayer): void => {
  const { ctx, canvas } = layer;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
};

export type CompositeLowResOptions = {
  ctx: Ctx;
  layer: LowResLayer;
  opacity?: number;
  composite?: GlobalCompositeOperation;
  smoothing?: boolean;
};

export const compositeLowRes = ({
  ctx,
  layer,
  opacity = 1,
  composite = 'source-over',
  smoothing = true,
}: CompositeLowResOptions): void => {
  if (opacity <= 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = composite;
  ctx.imageSmoothingEnabled = smoothing;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(layer.canvas, 0, 0, layer.width, layer.height);
  ctx.restore();
};
