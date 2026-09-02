/**
 * Additive bloom over whatever has already been drawn into `ctx`: downsample
 * it into `buffer`, blur that, add it back with 'lighter'.
 *
 * `buffer` should be allocated once (useMemo) at a fraction of the canvas
 * size — half is usually indistinguishable from full and roughly four times
 * cheaper, since the blur radius scales down with it.
 *
 * Apply this per layer, to the layers that should glow. Blooming the whole
 * composited frame instead will lift everything that happens to be pale —
 * fog, haze, a light sky — which is almost never what is wanted.
 */
export const applyBloom = (
  ctx: CanvasRenderingContext2D,
  buffer: HTMLCanvasElement,
  width: number,
  height: number,
  radius: number,
  strength: number,
) => {
  if (strength <= 0 || radius <= 0) return;
  const bctx = buffer.getContext("2d");
  if (!bctx) return;
  const scale = buffer.width / width;
  bctx.clearRect(0, 0, buffer.width, buffer.height);
  bctx.drawImage(ctx.canvas, 0, 0, buffer.width, buffer.height);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = strength;
  ctx.filter = `blur(${radius * scale}px)`;
  ctx.drawImage(buffer, 0, 0, width, height);
  ctx.filter = "none";
  ctx.restore();
};
