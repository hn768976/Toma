export type Ctx = CanvasRenderingContext2D;

export const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

export const context2d = (c: HTMLCanvasElement): Ctx => {
  const ctx = c.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("2d context unavailable");
  return ctx;
};

/**
 * Blur a whole buffer ONCE, with a brightness boost applied first so that
 * defocused highlights BLOOM into soft glowing marks instead of fading to
 * nothing. Per-element blurring would be unusably slow at 4K.
 *
 * Large radii are done at reduced resolution — a 70px blur carries no detail
 * that survives a 1/4 downsample, and the saving is what keeps a 4K still
 * inside a sane render time.
 */
export const blurred = (
  src: HTMLCanvasElement,
  radius: number,
  bloom: number,
): HTMLCanvasElement => {
  if (radius <= 0.5 && bloom <= 1.001) return src;

  const down = radius <= 4 ? 1 : Math.min(4, Math.max(1, Math.round(radius / 10)));
  const w = Math.ceil(src.width / down);
  const h = Math.ceil(src.height / down);

  const small = makeCanvas(w, h);
  const sctx = context2d(small);
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  // Brightness BEFORE blur: the bloom has to be in the signal that gets
  // spread, not applied to the result.
  sctx.filter =
    `saturate(${(1 + (bloom - 1) * 0.55).toFixed(2)}) ` +
    `brightness(${bloom}) blur(${(radius / down).toFixed(3)}px)`;
  sctx.drawImage(src, 0, 0, w, h);
  sctx.filter = "none";

  if (down === 1) return small;

  const up = makeCanvas(src.width, src.height);
  const uctx = context2d(up);
  uctx.imageSmoothingEnabled = true;
  uctx.imageSmoothingQuality = "high";
  uctx.drawImage(small, 0, 0, src.width, src.height);
  return up;
};

export type Placement = {
  /** Centre of the layer in destination pixels. */
  cx: number;
  cy: number;
  /** Destination width and height before keystoning. */
  w: number;
  h: number;
  /** In-plane rotation, radians. */
  rotation: number;
  /**
   * Ratio of the far edge's height to the near edge's height. 1 is no
   * perspective; < 1 recedes to the right, > 1 recedes to the left.
   */
  keystone: number;
  /** Vertical shear, applied after keystoning. */
  shear: number;
  alpha: number;
  composite: GlobalCompositeOperation;
  /** Linear alpha ramp across the layer, in layer space. */
  fade?: { from: number; to: number; angle: number };
  /** Slice count for the keystone; higher is smoother and slower. */
  slices: number;
};

/**
 * Composite a rendered layer into the destination with a true projective
 * keystone, approximated by column slices.
 *
 * The destination trapezoid has straight edges, so its height varies
 * LINEARLY across x; the source column that lands at destination fraction t
 * is the projective u(t) = t / (k(1 - t) + t). Straight affine scaling would
 * only ever produce a parallelogram, which is exactly the flat look this
 * whole image is trying to avoid.
 */
export const placeLayer = (
  dst: Ctx,
  src: HTMLCanvasElement,
  p: Placement,
): void => {
  const faded = p.fade ? applyFade(src, p.fade) : src;

  dst.save();
  dst.globalCompositeOperation = p.composite;
  dst.globalAlpha = p.alpha;
  dst.translate(p.cx, p.cy);
  dst.rotate(p.rotation);
  dst.transform(1, p.shear, 0, 1, 0, 0);
  dst.imageSmoothingEnabled = true;
  dst.imageSmoothingQuality = "high";

  const k = p.keystone;
  const n = Math.max(1, Math.round(p.slices));
  const sw = faded.width;
  const sh = faded.height;
  const u = (t: number) => t / (k * (1 - t) + t);

  // Normalise so the tallest edge is p.h — keeps the layer inside its box
  // whichever way it recedes.
  const hNear = p.h / Math.max(1, k);
  const hFar = hNear * k;

  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const u0 = u(t0);
    const u1 = u(t1);
    const sx = u0 * sw;
    const sWidth = Math.max(0.5, (u1 - u0) * sw);
    if (sx >= sw) break;

    const dx0 = (t0 - 0.5) * p.w;
    const dx1 = (t1 - 0.5) * p.w;
    const hMid = hNear + (hFar - hNear) * ((t0 + t1) / 2);
    // Half a pixel of overlap hides the seam between slices.
    dst.drawImage(
      faded,
      sx,
      0,
      Math.min(sWidth, sw - sx),
      sh,
      dx0,
      -hMid / 2,
      dx1 - dx0 + 0.75,
      hMid,
    );
  }
  dst.restore();
};

const applyFade = (
  src: HTMLCanvasElement,
  fade: { from: number; to: number; angle: number },
): HTMLCanvasElement => {
  const out = makeCanvas(src.width, src.height);
  const ctx = context2d(out);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  const r = (Math.max(src.width, src.height) * 1.2) / 2;
  const cx = src.width / 2;
  const cy = src.height / 2;
  const dx = Math.cos(fade.angle) * r;
  const dy = Math.sin(fade.angle) * r;
  const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  g.addColorStop(0, `rgba(0,0,0,${fade.from})`);
  g.addColorStop(1, `rgba(0,0,0,${fade.to})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, src.width, src.height);
  return out;
};

/**
 * Give a layer a temperature of its own, preserving its alpha.
 *
 * A warm curve over cool candles has to hold two temperatures in one frame
 * whatever the palette is doing, and a palette's "secondary curve" slot is
 * warm in some palettes and cold in others. Scaling channels cannot turn a
 * blue into an amber — it can only subtract — so the recolour goes through
 * sepia + hue-rotate, which lands on a real hue.
 *
 * The result is then cross-faded against the original rather than replacing
 * it: at partial strength a candle layer reads cool while its up and down
 * candles still differ, which a full recolour would flatten.
 */
export const tinted = (
  src: HTMLCanvasElement,
  warmth: number,
): HTMLCanvasElement => {
  const amount = Math.min(1, Math.abs(warmth));
  if (amount < 0.01) return src;

  const recoloured = makeCanvas(src.width, src.height);
  const rctx = context2d(recoloured);
  rctx.filter =
    `sepia(1) saturate(${(1.5 + 1.7 * amount).toFixed(2)}) ` +
    `hue-rotate(${warmth > 0 ? -16 : 172}deg)`;
  rctx.drawImage(src, 0, 0);
  rctx.filter = "none";

  const out = makeCanvas(src.width, src.height);
  const ctx = context2d(out);
  ctx.drawImage(src, 0, 0);
  ctx.globalAlpha = amount * 0.75;
  ctx.drawImage(recoloured, 0, 0);
  ctx.globalAlpha = 1;
  // Restore the original alpha exactly, so the cross-fade cannot widen the
  // layer's silhouette.
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(src, 0, 0);
  return out;
};

/**
 * Per-channel multipliers for the flare's colour. The flare is a light
 * source rather than a recoloured layer, so a straight channel tilt is both
 * enough and physically closer to what a warm or cool source does.
 * -1 fully cool, +1 fully warm.
 */
export const flareTemperature = (w: number): [number, number, number] =>
  w >= 0
    ? [1, 1 - 0.09 * w, 1 - 0.36 * w]
    : [1 - 0.34 * -w, 1 - 0.06 * -w, 1];
