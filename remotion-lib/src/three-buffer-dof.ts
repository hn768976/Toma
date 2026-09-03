/**
 * threeBufferDOF — depth-of-field for large numbers of 2D sprites, done with
 * three offscreen buffers instead of a per-object blur.
 *
 * Blurring hundreds of objects individually is unaffordable; blurring three
 * buffers is not. Objects are bucketed by depth, drawn into the buffer for
 * their bucket, and each buffer is blurred exactly ONCE on its way into the
 * destination — far to near, so nearer buckets occlude further ones.
 *
 * The near bucket is the most heavily blurred, so it is also rendered at a
 * reduced resolution: the blur hides the downscale completely and the memory
 * saved at 4K is substantial.
 *
 * Palette-agnostic and stateless apart from the buffers themselves; create it
 * once (useMemo) and reuse it across frames.
 *
 * @example
 *   const dof = useMemo(() => createThreeBufferDOF(3840, 2160), []);
 *   dof.clear();
 *   dof.contexts[bucket].globalAlpha = a;
 *   blitGlyph(dof.contexts[bucket], atlas, i, x * dof.scales[bucket], y * dof.scales[bucket], dof.scales[bucket]);
 *   dof.composite(ctx, 3840, 2160);
 */
import { offscreen } from "./canvas";

export type DepthBucket = {
  name: string;
  /** Buffer resolution as a fraction of the destination. */
  scale: number;
  /** Blur radius applied on compositing, in destination pixels. */
  blur: number;
};

/** far (small, slow, sharp) -> mid -> near (large, fast, soft). */
export const DEFAULT_DEPTH_BUCKETS: DepthBucket[] = [
  { name: "far", scale: 1, blur: 0 },
  { name: "mid", scale: 0.85, blur: 1.6 },
  { name: "near", scale: 0.6, blur: 5 },
];

export type ThreeBufferDOF = {
  buckets: DepthBucket[];
  canvases: HTMLCanvasElement[];
  contexts: CanvasRenderingContext2D[];
  /** Coordinate scale to apply when drawing into each bucket's buffer. */
  scales: number[];
  clear: () => void;
  composite: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => void;
};

export const createThreeBufferDOF = (
  width: number,
  height: number,
  buckets: DepthBucket[] = DEFAULT_DEPTH_BUCKETS,
): ThreeBufferDOF => {
  const surfaces = buckets.map((bucket) =>
    offscreen(width * bucket.scale, height * bucket.scale),
  );

  return {
    buckets,
    canvases: surfaces.map((surface) => surface.canvas),
    contexts: surfaces.map((surface) => surface.ctx),
    scales: buckets.map((bucket) => bucket.scale),
    clear: () => {
      for (const { canvas, ctx } of surfaces) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.filter = "none";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    },
    composite: (ctx, destWidth, destHeight) => {
      for (let i = 0; i < buckets.length; i++) {
        ctx.filter = buckets[i].blur > 0 ? `blur(${buckets[i].blur}px)` : "none";
        ctx.globalAlpha = 1;
        ctx.drawImage(surfaces[i].canvas, 0, 0, destWidth, destHeight);
      }
      ctx.filter = "none";
    },
  };
};

/** Picks a bucket index from a normalised depth (0 = far, 1 = near). */
export const bucketForDepth = (z: number, bucketCount = 3) =>
  Math.min(bucketCount - 1, Math.floor(z * bucketCount));
