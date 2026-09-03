// Vendored from remotion-lib (see its CATALOG.md). Keep in sync with
// the library copy; this project ships standalone, so the file lives here.
import { makeBuffer, type Ctx } from "./canvas";
import { clamp } from "./colour";

/**
 * A three-bucket depth-of-field rig.
 *
 * Content is bucketed by depth and each bucket is drawn into its own
 * offscreen buffer, then every buffer is blurred exactly ONCE and the three
 * are composited. Blurring per object is unusably slow at 4K; this is three
 * blurs per frame regardless of how many objects there are.
 *
 * A buffer may be allocated at a fraction of the output size: a bucket that
 * is going to be blurred heavily loses nothing at half resolution and costs a
 * quarter as much to blur.
 *
 * Samples that fall in a feather zone between two buckets are drawn into both
 * at complementary weights. Because the buffers composite additively, the two
 * halves sum back to full brightness and no seam appears at the boundary.
 *
 * @example
 *   const dof = createDepthBuffers(3840, 2160, [
 *     { scale: 0.5, blur: 28, gain: 0.45, halo: 18 },
 *     { scale: 1,   blur: 1.5, gain: 1,   halo: 16 },
 *     { scale: 0.5, blur: 7,  gain: 0.9,  halo: 10 },
 *   ]);
 *   clearDepthBuffers(dof);
 *   const w = bucketWeights(d, 0.58, 0.18, 0.07);
 *   // ...draw into dof.ctxs[k] at alpha * w[k]...
 *   compositeDepthBuffers(mainCtx, dof, 3840, 2160);
 */
export type DepthBucketSpec = {
  /** Buffer size as a fraction of the output. */
  scale: number;
  /** Blur radius applied at composite time, in OUTPUT px. */
  blur: number;
  /** Compositing gain for this bucket. */
  gain: number;
  /**
   * Width of the halo added to the bucket before compositing, in buffer px.
   * This is what gives every drawn curve its soft glow — once per bucket
   * rather than once per curve.
   */
  halo: number;
  /** Alpha of that halo. Default 0.5. */
  haloAlpha?: number;
};

export type DepthBuffers = {
  specs: DepthBucketSpec[];
  canvases: HTMLCanvasElement[];
  ctxs: Ctx[];
  width: number;
  height: number;
};

export const createDepthBuffers = (
  width: number,
  height: number,
  specs: DepthBucketSpec[],
): DepthBuffers => {
  const canvases = specs.map((s) =>
    makeBuffer(Math.round(width * s.scale), Math.round(height * s.scale)),
  );
  return {
    specs,
    canvases,
    ctxs: canvases.map((c) => c.getContext("2d") as Ctx),
    width,
    height,
  };
};

/**
 * Clear every buffer and set its device scale, leaving each context in
 * additive mode ready to be drawn into with output-space coordinates.
 */
export const clearDepthBuffers = (b: DepthBuffers) => {
  b.ctxs.forEach((ctx, k) => {
    const s = b.specs[k].scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, b.width * s, b.height * s);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.globalCompositeOperation = "lighter";
  });
};

/**
 * Cross-fade weights across three depth buckets: [near, mid, far]. Depth runs
 * 0 at the horizon to 1 at the camera.
 */
export const bucketWeights = (
  d: number,
  near: number,
  far: number,
  feather: number,
): [number, number, number] => {
  const ramp = (edge: number) => clamp((d - (edge - feather)) / (2 * feather), 0, 1);
  const nearW = ramp(near);
  const midHigh = 1 - nearW;
  const farW = 1 - ramp(far);
  return [nearW, clamp(midHigh - farW, 0, 1), farW];
};

/**
 * Add each bucket's halo, then blur each buffer once and composite all of
 * them additively onto the target, furthest bucket first.
 */
export const compositeDepthBuffers = (
  main: Ctx,
  b: DepthBuffers,
) => {
  for (let k = 0; k < b.ctxs.length; k++) {
    const ctx = b.ctxs[k];
    const spec = b.specs[k];
    if (spec.halo > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.filter = `blur(${spec.halo}px)`;
      ctx.globalAlpha = spec.haloAlpha ?? 0.5;
      ctx.drawImage(b.canvases[k], 0, 0);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
    }
  }

  main.setTransform(1, 0, 0, 1, 0, 0);
  main.globalCompositeOperation = "lighter";
  main.imageSmoothingEnabled = true;
  main.imageSmoothingQuality = "high";
  for (let k = b.ctxs.length - 1; k >= 0; k--) {
    const spec = b.specs[k];
    main.globalAlpha = spec.gain;
    main.filter = `blur(${spec.blur * spec.scale}px)`;
    main.drawImage(b.canvases[k], 0, 0, b.width, b.height);
  }
  main.globalAlpha = 1;
  main.filter = "none";
  main.globalCompositeOperation = "source-over";
};
