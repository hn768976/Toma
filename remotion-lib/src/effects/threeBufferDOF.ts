/**
 * threeBufferDOF.ts — depth of field via three offscreen buffers.
 *
 * WHAT IT DOES
 *   Buckets drawable elements into far / mid / near by depth, draws each
 *   bucket into its own offscreen canvas, blurs each buffer ONCE as a
 *   whole, then composites far -> mid -> near onto the destination.
 *
 * WHAT IT IS FOR
 *   Fake depth of field over a field of many elements. The obvious
 *   implementation — set ctx.filter = `blur(Npx)` per element and draw
 *   each one — is O(elements) full filter setups, and at 4K with a few
 *   thousand particles it is catastrophically slow: each filter change
 *   forces the rasteriser to allocate and tear down a filter region. The
 *   buffer approach is O(buckets) blurs, i.e. three, regardless of how
 *   many elements are in them.
 *
 * WHY THREE AND NOT N
 *   Three is the point where the cost curve and the perceptual return
 *   cross. Two reads as a cutout — the eye sees a sharp plane and a soft
 *   plane with nothing between. Four or more costs another full-canvas
 *   blur each for a difference almost nobody can see, because blur radii
 *   in adjacent buckets are already within a couple of pixels. Use
 *   `depthBuffers` below if a shot genuinely needs more.
 *
 * PARAMETERS
 *   ctx               destination 2D context
 *   width, height     buffer size in px — match the composition exactly
 *   far / mid / near  draw callbacks, each `(ctx) => void`. Draw the
 *                     bucket's elements in the buffer's own coordinate
 *                     space; it is the same space as the destination.
 *   farBlur           px. Default 12.
 *   midBlur           px. Default 4.
 *   nearBlur          px. Default 0 — the near plane is the subject and
 *                     is normally the sharp one.
 *   compositeOp       how buffers land on the destination. Default
 *                     "source-over". Use "lighter" for glowing/additive
 *                     elements, where overlapping dots should sum rather
 *                     than occlude.
 *   createCanvas      injectable canvas factory; defaults to
 *                     document.createElement("canvas"). Override to run
 *                     under OffscreenCanvas or in a test.
 *
 * SCALING GOTCHA
 *   Blur radii are in device pixels, so they do NOT survive a resolution
 *   change. Rendering the same composition at 4K with the same farBlur
 *   halves the apparent blur. Multiply every blur by your resolution
 *   scale, exactly as you would a stroke width.
 *
 * ORDERING GOTCHA
 *   Buffers composite in the order far, mid, near — later buffers paint
 *   over earlier ones. Within a bucket, ordering is whatever the callback
 *   draws, so sort inside the callback if elements in one plane need to
 *   occlude each other.
 *
 * USAGE
 *   const { far, mid, near } = bucketByDepth(particles, (p) => p.z);
 *   threeBufferDOF({
 *     ctx, width, height, compositeOp: "lighter",
 *     far:  (c) => far.forEach((p) => dot(c, p)),
 *     mid:  (c) => mid.forEach((p) => dot(c, p)),
 *     near: (c) => near.forEach((p) => dot(c, p)),
 *   });
 */

export type DrawFn = (ctx: CanvasRenderingContext2D) => void;

export type CanvasFactory = (
  width: number,
  height: number,
) => HTMLCanvasElement | null;

const defaultCreateCanvas: CanvasFactory = (width, height) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export type DepthLayer = {
  draw: DrawFn;
  blurPx: number;
};

export type DepthBuffersOptions = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Back to front: index 0 is composited first. */
  layers: DepthLayer[];
  compositeOp?: GlobalCompositeOperation;
  createCanvas?: CanvasFactory;
};

/**
 * The general form: N layers, each blurred once and composited back to
 * front. `threeBufferDOF` is this with the conventional three buckets.
 */
export const depthBuffers = ({
  ctx,
  width,
  height,
  layers,
  compositeOp = "source-over",
  createCanvas = defaultCreateCanvas,
}: DepthBuffersOptions): void => {
  const previousOp = ctx.globalCompositeOperation;
  const previousFilter = ctx.filter;

  for (const layer of layers) {
    const buffer = createCanvas(width, height);
    const bufferCtx = buffer?.getContext("2d");
    if (!buffer || !bufferCtx) continue;

    // Draw the bucket sharp, into its own transparent buffer...
    layer.draw(bufferCtx);

    // ...then blur exactly once, on the way to the destination.
    ctx.globalCompositeOperation = compositeOp;
    ctx.filter = layer.blurPx > 0 ? `blur(${layer.blurPx}px)` : "none";
    ctx.drawImage(buffer, 0, 0);
  }

  ctx.filter = previousFilter;
  ctx.globalCompositeOperation = previousOp;
};

export type ThreeBufferDOFOptions = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  far: DrawFn;
  mid: DrawFn;
  near: DrawFn;
  farBlur?: number;
  midBlur?: number;
  nearBlur?: number;
  compositeOp?: GlobalCompositeOperation;
  createCanvas?: CanvasFactory;
};

export const threeBufferDOF = ({
  ctx,
  width,
  height,
  far,
  mid,
  near,
  farBlur = 12,
  midBlur = 4,
  nearBlur = 0,
  compositeOp = "source-over",
  createCanvas = defaultCreateCanvas,
}: ThreeBufferDOFOptions): void =>
  depthBuffers({
    ctx,
    width,
    height,
    compositeOp,
    createCanvas,
    layers: [
      { draw: far, blurPx: farBlur },
      { draw: mid, blurPx: midBlur },
      { draw: near, blurPx: nearBlur },
    ],
  });

export type DepthBuckets<T> = {
  far: T[];
  mid: T[];
  near: T[];
};

/**
 * Splits items into three buckets by a depth accessor.
 *
 * `thresholds` are the two cut points on whatever scale getDepth returns.
 * Default [0.33, 0.66] assumes a normalised 0..1 depth where 0 is
 * furthest. Items below thresholds[0] are far; at or above thresholds[1]
 * are near.
 */
export const bucketByDepth = <T,>(
  items: readonly T[],
  getDepth: (item: T) => number,
  thresholds: [number, number] = [0.33, 0.66],
): DepthBuckets<T> => {
  const buckets: DepthBuckets<T> = { far: [], mid: [], near: [] };
  for (const item of items) {
    const depth = getDepth(item);
    if (depth < thresholds[0]) buckets.far.push(item);
    else if (depth < thresholds[1]) buckets.mid.push(item);
    else buckets.near.push(item);
  }
  return buckets;
};
