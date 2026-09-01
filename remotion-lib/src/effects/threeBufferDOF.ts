/**
 * threeBufferDOF — near/mid/far offscreen buffer depth of field.
 *
 * WHAT: Bucket your scene elements by depth, draw each bucket into its own
 * offscreen buffer, blur each buffer ONCE, then composite far -> mid -> near.
 *
 * WHY: per-element blurring is always the wrong answer at 4K. Setting
 * `ctx.filter = 'blur(Npx)'` per element makes the browser allocate, blur and
 * composite a surface per element; with a few hundred elements that is
 * seconds per frame. Bucketing means exactly `levels` blur operations per
 * frame regardless of element count. This pattern appears in almost every
 * source project that has any depth at all.
 *
 * WHY THREE: two buckets show a visible jump between sharp and blurred. Four or
 * more costs another full-frame blur for a difference the eye does not find.
 * Three is the value every source project converged on, so it is the default —
 * but `levels` is a parameter, and `blurPx` may be any length.
 *
 * THE BLEED MARGIN: buffers are allocated larger than the frame by `bleed` on
 * every side. A blur samples outward, so without the margin a blurred element
 * near the edge fades against nothing and produces a dark rim along the frame
 * border. Default is 3x the largest blur, which is enough for a Gaussian to
 * have fallen to nothing.
 *
 * PARAMETERS (createDofBuffers)
 *   width, height  Frame size in px.
 *   blurPx         Blur radius per level, far to near. Default [24, 8, 0].
 *                  The last should normally be 0 — the in-focus plane.
 *   bleed          Margin in px on each side. Defaults to 3x max blur.
 *
 * PARAMETERS (compositeDof)
 *   ctx            Destination context, frame-sized.
 *   buffers        From `createDofBuffers`.
 *   recede         0..1. Washes each blurred layer toward `recedeColor` before
 *                  compositing, so defocused content LOSES contrast instead of
 *                  glowing. Default 0. This is the detail that separates a
 *                  convincing depth cue from a smudge: real defocused content
 *                  is lower in contrast, not merely softer.
 *   recedeColor    Colour washed toward. Required if `recede` > 0 — there is no
 *                  default, because it must match your background.
 *
 * USAGE SHAPE
 *   const buf = createDofBuffers({ width: 1920, height: 1080 });
 *   clearDofBuffers(buf);
 *   for (const el of elements) {
 *     const ctx = bufferFor(buf, el.depth);   // pick a bucket
 *     drawElement(ctx, el);                    // draw in buffer space
 *   }
 *   compositeDof({ ctx: frameCtx, buffers: buf, recede: 0.5, recedeColor: '#05070D' });
 *
 * GOTCHA: buffer contexts are translated by `bleed`, so you draw in ordinary
 * frame coordinates and the margin is handled for you. Do not add `bleed`
 * yourself.
 *
 * GOTCHA: allocate buffers ONCE per resolution — via useMemo in a Remotion
 * component — and clear them each frame. Allocating per frame is most of the
 * cost this pattern exists to avoid. The buffers hold no state between frames.
 */
import type { Ctx } from '../types';

export type DofBuffers = {
  width: number;
  height: number;
  bleed: number;
  /** Blur radius per level, in the same order as `layers`. */
  blurPx: number[];
  /** One offscreen canvas per level, far to near. */
  layers: HTMLCanvasElement[];
  /** Pre-translated contexts, so callers draw in frame coordinates. */
  contexts: Ctx[];
};

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

const ctxOf = (c: HTMLCanvasElement): Ctx => {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable for a DOF buffer');
  return ctx;
};

export type CreateDofBuffersOptions = {
  width: number;
  height: number;
  blurPx?: number[];
  bleed?: number;
};

export const createDofBuffers = ({
  width,
  height,
  blurPx = [24, 8, 0],
  bleed,
}: CreateDofBuffersOptions): DofBuffers => {
  const margin = bleed ?? Math.ceil(Math.max(...blurPx, 0) * 3);
  const bw = width + margin * 2;
  const bh = height + margin * 2;

  const layers = blurPx.map(() => makeCanvas(bw, bh));
  const contexts = layers.map((c) => {
    const ctx = ctxOf(c);
    ctx.translate(margin, margin);
    return ctx;
  });

  return { width, height, bleed: margin, blurPx: [...blurPx], layers, contexts };
};

/** Clears every buffer. Call once at the top of each frame. */
export const clearDofBuffers = (buffers: DofBuffers): void => {
  const { layers, contexts } = buffers;
  contexts.forEach((ctx, i) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layers[i].width, layers[i].height);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
  });
};

/**
 * Picks the bucket for a normalised depth.
 *
 * `depth` is 0 (far) to 1 (near). Buckets are equal width; index 0 is the
 * blurriest. Out-of-range depths clamp rather than throw, because a physics
 * step that overshoots should not kill the render.
 */
export const bufferFor = (buffers: DofBuffers, depth: number): Ctx => {
  const n = buffers.contexts.length;
  const i = Math.min(n - 1, Math.max(0, Math.floor(depth * n)));
  return buffers.contexts[i];
};

/** Same bucketing rule, when you want the index rather than the context. */
export const bucketFor = (buffers: DofBuffers, depth: number): number => {
  const n = buffers.contexts.length;
  return Math.min(n - 1, Math.max(0, Math.floor(depth * n)));
};

export type CompositeDofOptions = {
  ctx: Ctx;
  buffers: DofBuffers;
  recede?: number;
  recedeColor?: string;
};

export const compositeDof = ({
  ctx,
  buffers,
  recede = 0,
  recedeColor,
}: CompositeDofOptions): void => {
  const { bleed, layers, blurPx } = buffers;

  if (recede > 0 && !recedeColor) {
    throw new Error(
      'compositeDof: recedeColor is required when recede > 0 — it must match your background',
    );
  }

  ctx.save();
  layers.forEach((layer, i) => {
    const blur = blurPx[i];

    // Wash this layer toward the background before compositing, so defocused
    // content loses contrast. `source-atop` keeps the layer's own alpha, so
    // only what was drawn is washed — the transparent margin stays empty.
    if (recede > 0 && blur > 0 && recedeColor) {
      const lctx = ctxOf(layer);
      lctx.save();
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalCompositeOperation = 'source-atop';
      // Scale the wash by how blurred this layer is, so the mid layer recedes
      // less than the far one without needing a second parameter.
      lctx.globalAlpha = Math.min(1, recede * (blur / Math.max(...blurPx, 1)));
      lctx.fillStyle = recedeColor;
      lctx.fillRect(0, 0, layer.width, layer.height);
      lctx.restore();
    }

    ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
    ctx.drawImage(layer, -bleed, -bleed);
  });
  ctx.filter = 'none';
  ctx.restore();
};
