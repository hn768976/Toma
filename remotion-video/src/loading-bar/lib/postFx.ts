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

/** Downscale-blur-upscale-add. `scratch` should be roughly 1/8 scale. */
export const bloomPass = (
  ctx: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  amount: number,
  blurPx: number,
): void => {
  const source = ctx.canvas;
  const sctx = scratch.getContext("2d");
  if (!sctx) {
    return;
  }
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = "source-over";
  sctx.globalAlpha = 1;
  sctx.clearRect(0, 0, scratch.width, scratch.height);
  sctx.filter = `blur(${blurPx}px)`;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(source, 0, 0, scratch.width, scratch.height);
  sctx.filter = "none";

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = amount;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(scratch, 0, 0, source.width, source.height);
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
