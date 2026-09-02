/**
 * Additive bloom.
 *
 * Takes whatever is already on `source`, shrinks it, blurs it and adds
 * it back on top of `ctx`. Downscaling first is what makes this
 * affordable at 4K: a `blur(n)` on a quarter-size buffer costs a
 * sixteenth of the same visual radius applied full size.
 */
export const bloomPass = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  opts: {
    width: number;
    height: number;
    /** Blur radius expressed in output pixels. */
    radius: number;
    strength: number;
    /** Resolution divisor for the intermediate buffer. */
    downscale?: number;
    scratch?: HTMLCanvasElement;
  },
): void => {
  const { width, height, radius, strength } = opts;
  if (strength <= 0) return;
  const down = opts.downscale ?? 4;
  const bw = Math.max(1, Math.round(width / down));
  const bh = Math.max(1, Math.round(height / down));

  const buf = opts.scratch ?? document.createElement("canvas");
  if (buf.width !== bw || buf.height !== bh) {
    buf.width = bw;
    buf.height = bh;
  }
  const bctx = buf.getContext("2d");
  if (!bctx) return;
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.clearRect(0, 0, bw, bh);
  bctx.globalCompositeOperation = "source-over";
  bctx.filter = "none";
  bctx.drawImage(source, 0, 0, bw, bh);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = strength;
  ctx.filter = `blur(${(radius / down).toFixed(2)}px)`;
  ctx.drawImage(buf, 0, 0, width, height);
  ctx.filter = "none";
  ctx.restore();
};
