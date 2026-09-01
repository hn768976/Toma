/**
 * bloomPass — threshold the bright parts, blur them, add them back.
 *
 * WHAT: Extracts pixels above a luminance threshold into a scratch buffer,
 * blurs that buffer at one or more radii, and composites the result back with
 * 'lighter'. Appears in 40 of the source projects.
 *
 * WHY: bright things in a real lens bleed into their surroundings. Without
 * bloom, a bright stroke on a dark ground looks like coloured tape. With it,
 * the same stroke reads as emitting light. It is what makes neon look hot
 * rather than merely saturated.
 *
 * WHY A BLUR LADDER: a single blur radius produces a uniform halo with a
 * findable edge. Real bloom has a tight bright core spill plus a very wide
 * faint wash. Compositing several radii at decreasing alpha reproduces that.
 * The default ladder is taken from the neon-light-streaks project, which had
 * the most carefully tuned version of this in the survey.
 *
 * PARAMETERS (bloomPass)
 *   ctx, width, height  Destination and frame size.
 *   source     Canvas to extract highlights from. Usually the same content you
 *              already drew — pass your scene buffer, not the frame you are
 *              compositing into, or the bloom will feed back on itself.
 *   scratch    A working canvas, frame-sized. Allocate once and reuse.
 *   threshold  Luminance above which a pixel blooms, 0..1. Default 0.6.
 *   ladder     Blur radii and their alphas. Default four stops from 6px to
 *              130px. Radii scale with your frame — the defaults suit 1080p;
 *              multiply them by 2 for 4K.
 *   intensity  Scales every ladder alpha at once. Default 1.
 *
 * GOTCHA: this reads pixels back with getImageData, which is the expensive part.
 * At 4K prefer `downscale: 4` (the default) so the threshold pass runs on a
 * quarter-size copy — bloom is blurry by definition, so the resolution is not
 * missed.
 *
 * GOTCHA: bloom composites with 'lighter' and so only works on a dark ground.
 * On light backgrounds it does nothing visible.
 *
 * EXAMPLE
 *   bloomPass({ ctx, width, height, source: sceneCanvas, scratch, threshold: 0.6 });
 */
import type { Ctx } from '../types';

export type BloomStop = {
  /** Blur radius in px, at the frame resolution. */
  blurPx: number;
  /** Alpha this stop contributes. */
  alpha: number;
};

/** Tight core spill through to a wide faint wash. */
export const DEFAULT_BLOOM_LADDER: readonly BloomStop[] = [
  { blurPx: 6, alpha: 0.55 },
  { blurPx: 20, alpha: 0.38 },
  { blurPx: 56, alpha: 0.26 },
  { blurPx: 130, alpha: 0.15 },
];

export type BloomPassOptions = {
  ctx: Ctx;
  width: number;
  height: number;
  source: HTMLCanvasElement;
  scratch?: HTMLCanvasElement;
  threshold?: number;
  ladder?: readonly BloomStop[];
  intensity?: number;
  downscale?: number;
};

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

export const bloomPass = ({
  ctx,
  width,
  height,
  source,
  scratch,
  threshold = 0.6,
  ladder = DEFAULT_BLOOM_LADDER,
  intensity = 1,
  downscale = 4,
}: BloomPassOptions): void => {
  if (intensity <= 0) return;

  const sw = Math.max(1, Math.round(width / downscale));
  const sh = Math.max(1, Math.round(height / downscale));

  const buffer = scratch ?? makeCanvas(sw, sh);
  if (buffer.width !== sw || buffer.height !== sh) {
    buffer.width = sw;
    buffer.height = sh;
  }
  const bctx = buffer.getContext('2d', { willReadFrequently: true });
  if (!bctx) throw new Error('2d context unavailable for the bloom buffer');

  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.globalCompositeOperation = 'source-over';
  bctx.globalAlpha = 1;
  bctx.filter = 'none';
  bctx.clearRect(0, 0, sw, sh);
  bctx.drawImage(source, 0, 0, sw, sh);

  // Threshold: zero the alpha of anything below the cut, and scale what remains
  // by how far above the cut it sits, so the bloom ramps in rather than
  // switching on at a hard edge.
  const image = bctx.getImageData(0, 0, sw, sh);
  const data = image.data;
  const cut = threshold * 255;
  for (let i = 0; i < data.length; i += 4) {
    // Rec.601 luma — matches how the eye weights the channels, so a saturated
    // blue does not bloom as hard as an equally bright yellow.
    const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    if (luma <= cut) {
      data[i + 3] = 0;
    } else {
      const excess = (luma - cut) / Math.max(1, 255 - cut);
      data[i + 3] = Math.min(255, data[i + 3] * excess);
    }
  }
  bctx.putImageData(image, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const stop of ladder) {
    const alpha = stop.alpha * intensity;
    if (alpha <= 0.002) continue;
    ctx.globalAlpha = Math.min(1, alpha);
    // Blur is specified at frame scale, so divide by the downscale factor to
    // get the equivalent radius on the smaller buffer.
    ctx.filter = `blur(${(stop.blurPx / downscale).toFixed(2)}px)`;
    ctx.drawImage(buffer, 0, 0, width, height);
  }
  ctx.filter = 'none';
  ctx.restore();
};
