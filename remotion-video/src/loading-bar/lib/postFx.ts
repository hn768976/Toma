import { rgba } from "./color";
import { seeded } from "./rand";

/**
 * Post-processing passes shared by every layer that needs to look
 * photographed rather than rasterised.
 *
 * All three are cheap by construction: the bloom round-trips through a
 * 1/8-scale scratch canvas, the vignette is one radial gradient, and the
 * grain is a pre-baked noise tile offset per frame instead of 8.3M
 * per-frame random() calls.
 */

export type BloomScratch = {
  a: HTMLCanvasElement;
  b: HTMLCanvasElement;
};

/**
 * Allocate the pair of scratch canvases `bloomPasses` works in. A
 * divisor of 8 is the sweet spot: the downscale is itself a blur, so a
 * few pixels of blur down here buy a very wide halo up there.
 */
export const makeBloomScratch = (
  width: number,
  height: number,
  divisor = 8,
): BloomScratch => {
  const make = () => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(width / divisor));
    c.height = Math.max(1, Math.round(height / divisor));
    return c;
  };
  return { a: make(), b: make() };
};

export type BloomLayer = {
  /** Blur radius *in scratch pixels* — multiply by the divisor for the
   * effective full-resolution radius. */
  blur: number;
  /** How much of the blurred copy to add back. */
  amount: number;
};

/**
 * Multi-radius bloom over whatever is already on `ctx`.
 *
 * This is how the piece gets its wide halos. A 190px canvas
 * `shadowBlur` at 3840x2160 costs enormously more than downscaling the
 * finished layer 8x, blurring a handful of pixels there and adding it
 * back — and unlike a shadow, a bloom picks its colour up from the
 * content, which is exactly right for emitted light.
 *
 * Every layer blurs the *same* snapshot (scratch `a`) and they are
 * summed in scratch `b`, so a tight glow and a wide halo stack without
 * the second compounding the first.
 *
 * `behind` composites the result with 'destination-over' instead of
 * 'lighter'. That is usually what you want for a coloured subject: an
 * additive bloom lands on top of its own source and drags the hue
 * toward white, whereas placing it behind leaves the letterforms and
 * the bar's fill at their exact palette colour and puts the halo
 * strictly outside them, spilling onto whatever is underneath.
 */
export const bloomPasses = (
  ctx: CanvasRenderingContext2D,
  scratch: BloomScratch,
  layers: BloomLayer[],
  behind = false,
): void => {
  const { a, b } = scratch;
  const actx = a.getContext("2d");
  const bctx = b.getContext("2d");
  if (!actx || !bctx) {
    return;
  }

  actx.setTransform(1, 0, 0, 1, 0, 0);
  actx.globalCompositeOperation = "source-over";
  actx.globalAlpha = 1;
  actx.filter = "none";
  actx.clearRect(0, 0, a.width, a.height);
  actx.imageSmoothingEnabled = true;
  actx.imageSmoothingQuality = "high";
  actx.drawImage(ctx.canvas, 0, 0, a.width, a.height);

  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.globalCompositeOperation = "source-over";
  bctx.globalAlpha = 1;
  bctx.filter = "none";
  bctx.clearRect(0, 0, b.width, b.height);
  bctx.globalCompositeOperation = "lighter";
  for (const layer of layers) {
    bctx.filter = `blur(${layer.blur}px)`;
    bctx.globalAlpha = layer.amount;
    bctx.drawImage(a, 0, 0);
  }
  bctx.filter = "none";

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = behind ? "destination-over" : "lighter";
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(b, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
};

export const vignettePass = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
): void => {
  const grad = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.22,
    width / 2,
    height / 2,
    Math.hypot(width, height) * 0.58,
  );
  grad.addColorStop(0, "rgba(0, 0, 0, 0)");
  grad.addColorStop(0.55, `rgba(0, 0, 0, ${strength * 0.28})`);
  grad.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

/**
 * Build a square, seamlessly tileable monochrome noise tile. Expensive
 * enough to be worth memoising, cheap enough to do once per mount.
 */
export const makeGrainTile = (size: number, seed: string): HTMLCanvasElement => {
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const ctx = tile.getContext("2d");
  if (!ctx) {
    return tile;
  }
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(seeded(`${seed}-${i}`) * 255);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return tile;
};

/**
 * Draw the grain tile, jittered per frame so it never looks printed on.
 * Composited source-over: the caller is expected to blend the resulting
 * layer (typically with an `overlay` mix-blend-mode) over the image.
 */
export const grainPass = (
  ctx: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  width: number,
  height: number,
  frame: number,
  alpha: number,
): void => {
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) {
    return;
  }
  const ox = Math.floor(seeded(`grain-offset-x-${frame}`) * tile.width);
  const oy = Math.floor(seeded(`grain-offset-y-${frame}`) * tile.height);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width + tile.width, height + tile.height);
  ctx.restore();
};

/** A soft elliptical pool of light, used for the glow behind the group. */
export const glowPool = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  alpha: number,
): void => {
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, rgba(color, alpha));
  grad.addColorStop(0.45, rgba(color, alpha * 0.42));
  grad.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};
