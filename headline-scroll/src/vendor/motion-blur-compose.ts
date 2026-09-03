// Vendored from @studio/remotion-lib (src/motion-blur-compose.ts). Do not edit here —
// edit the library and re-run `node scripts/sync-lib.mjs`.
/**
 * Flattens a two-layer sprite into the single bitmap a scroll blits every
 * frame: tilt, drop shadow and directional motion blur are baked in once, at
 * build time, which is the only way type-heavy artwork renders at 4K.
 *
 * The motion blur is a true box filter, not a ghost trail: N shifted copies
 * are accumulated with `lighter` at 1/N alpha each, which sums premultiplied
 * colour *and* alpha to their exact average. Repeated source-over draws at
 * 1/N would instead weight the copies exponentially and read as a trail.
 *
 * Only correct for constant velocity — which is the case it exists for.
 */
import { context2d, makeCanvas, releaseCanvas, setBlur } from "./canvas2d";
import { withAlpha } from "./color";

export type Axis = "vertical" | "horizontal";

/**
 * A sprite in two layers: an opaque `base`, and an `overlay` drawn back over
 * it that receives a shorter shutter. Anything whose sharpness should survive
 * the motion — the word a viewer is meant to hold — goes in the overlay.
 */
export interface LayeredSprite {
  base: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  /** Where the overlay sits within the base, in base coordinates. */
  overlayOffset: { x: number; y: number };
  /** A point of interest in base coordinates, reported back after tilt. */
  anchor: { x: number; y: number };
  width: number;
  height: number;
}

export interface ComposedSprite {
  canvas: HTMLCanvasElement;
  /** Footprint of the tilted sprite — the motion pad is excluded. */
  extentX: number;
  extentY: number;
  /** The sprite's anchor, relative to its centre, after tilt. */
  anchorOffsetX: number;
  anchorOffsetY: number;
}

export interface ComposeOptions {
  axis: Axis;
  tiltDeg: number;
  /** Travel, in pixels, covered during one shutter opening. */
  shutter: number;
  /** The overlay's shorter shutter. Always less than `shutter`. */
  overlayShutter: number;
  samples: number;
  shadow: { color: string; alpha: number; blur: number; offset: number } | null;
}

const rotatePoint = (x: number, y: number, cos: number, sin: number) => ({
  x: x * cos - y * sin,
  y: x * sin + y * cos,
});

/** Accumulates `source`, tilted, at N offsets along the axis, into `target`. */
const accumulate = (
  target: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  centreX: number,
  centreY: number,
  theta: number,
  axis: Axis,
  spread: number,
  samples: number,
): void => {
  const n = spread > 0.5 ? samples : 1;
  target.save();
  target.globalCompositeOperation = "lighter";
  target.globalAlpha = 1 / n;
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const dx = axis === "horizontal" ? t * spread : 0;
    const dy = axis === "vertical" ? t * spread : 0;
    target.save();
    target.translate(centreX + dx, centreY + dy);
    target.rotate(theta);
    target.drawImage(source, -source.width / 2, -source.height / 2);
    target.restore();
  }
  target.restore();
};

export const composeMotionBlurred = (
  layers: LayeredSprite,
  o: ComposeOptions,
): ComposedSprite => {
  const theta = (o.tiltDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(theta));
  const sin = Math.abs(Math.sin(theta));
  const W = layers.width;
  const H = layers.height;
  const extentX = W * cos + H * sin;
  const extentY = W * sin + H * cos;

  const shadowPad = o.shadow ? o.shadow.blur * 1.6 + o.shadow.offset : 0;
  const padX = (o.axis === "horizontal" ? o.shutter / 2 : 0) + shadowPad + 4;
  const padY = (o.axis === "vertical" ? o.shutter / 2 : 0) + shadowPad + 4;

  const canvas = makeCanvas(extentX + padX * 2, extentY + padY * 2);
  const ctx = context2d(canvas);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // Drop shadow, offset down-left. Inset so the blur wraps the card evenly.
  if (o.shadow) {
    ctx.save();
    setBlur(ctx, o.shadow.blur);
    ctx.translate(cx - o.shadow.offset, cy + o.shadow.offset);
    ctx.rotate(theta);
    ctx.fillStyle = withAlpha(o.shadow.color, o.shadow.alpha);
    ctx.fillRect(-W / 2 + 10, -H / 2 + 10, W - 20, H - 20);
    ctx.restore();
  }

  // Motion-blurred body, on its own accumulation buffer.
  const bodyBuffer = makeCanvas(canvas.width, canvas.height);
  const bodyCtx = context2d(bodyBuffer);
  accumulate(bodyCtx, layers.base, cx, cy, theta, o.axis, o.shutter, o.samples);
  ctx.drawImage(bodyBuffer, 0, 0);
  releaseCanvas(bodyBuffer);

  // The overlay, with a shorter shutter, placed back where it belongs.
  const kw = layers.overlay;
  const kwCentreLocalX = layers.overlayOffset.x + kw.width / 2 - W / 2;
  const kwCentreLocalY = layers.overlayOffset.y + kw.height / 2 - H / 2;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const kwCentre = rotatePoint(kwCentreLocalX, kwCentreLocalY, c, s);

  const kwExtentX = kw.width * cos + kw.height * sin;
  const kwExtentY = kw.width * sin + kw.height * cos;
  const kwBuffer = makeCanvas(
    kwExtentX + (o.axis === "horizontal" ? o.overlayShutter : 0) + 4,
    kwExtentY + (o.axis === "vertical" ? o.overlayShutter : 0) + 4,
  );
  const kwCtx = context2d(kwBuffer);
  accumulate(
    kwCtx,
    kw,
    kwBuffer.width / 2,
    kwBuffer.height / 2,
    theta,
    o.axis,
    o.overlayShutter,
    o.samples,
  );
  ctx.drawImage(
    kwBuffer,
    cx + kwCentre.x - kwBuffer.width / 2,
    cy + kwCentre.y - kwBuffer.height / 2,
  );
  releaseCanvas(kwBuffer);

  const anchorOffset = rotatePoint(
    layers.anchor.x - W / 2,
    layers.anchor.y - H / 2,
    c,
    s,
  );

  releaseCanvas(layers.base);
  releaseCanvas(layers.overlay);

  return {
    canvas,
    extentX,
    extentY,
    anchorOffsetX: anchorOffset.x,
    anchorOffsetY: anchorOffset.y,
  };
};
