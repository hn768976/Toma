import { blurPx, depthOf, sizeMul } from "./depth";
import type { Debris } from "./elements";
import { rgbCss, sampleRamp, type Palette } from "./palette";

/** Base element size, as a fraction of frame height. */
const UNIT = 0.0086;

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Half-extents, so drawing is `drawImage(c, x - hw, y - hh)`. */
  hw: number;
  hh: number;
}

const drawGeometry = (
  ctx: CanvasRenderingContext2D,
  el: Debris,
  px: number,
  minThickness: number,
) => {
  ctx.beginPath();
  if (el.circleR > 0) {
    ctx.arc(0, 0, Math.max(minThickness / 2, el.circleR * px), 0, Math.PI * 2);
  } else {
    for (const r of el.rects) {
      const w = Math.max(minThickness, r.w * px);
      const h = Math.max(minThickness, r.h * px);
      ctx.rect(r.x * px, r.y * px, w, h);
    }
  }
  ctx.fill();
};

const geometryExtent = (el: Debris, px: number, minThickness: number) => {
  if (el.circleR > 0) {
    const r = Math.max(minThickness / 2, el.circleR * px);
    return { hw: r, hh: r };
  }
  let hw = 0;
  let hh = 0;
  for (const r of el.rects) {
    const w = Math.max(minThickness, r.w * px);
    const h = Math.max(minThickness, r.h * px);
    hw = Math.max(hw, Math.abs(r.x), Math.abs(r.x + w));
    hh = Math.max(hh, Math.abs(r.y), Math.abs(r.y + h));
  }
  return { hw, hh };
};

/**
 * Bakes one element into a small sprite: its own depth blur and, for the sharp
 * mid band and the accents, its bloom. Blur then costs one filtered draw per
 * element for the whole render instead of a filter per element per frame.
 */
const buildSprite = (el: Debris, palette: Palette, height: number): Sprite => {
  const d = depthOf(el.bucket);
  const px = height * UNIT * sizeMul(d) * el.unitScale;
  const blur = blurPx(d, height);
  const minThickness = height * 0.00055;

  // Bloom belongs to the sharp band and the accents only. If the near smears
  // glowed, the depth would read inverted.
  const sharpness = Math.max(0, 1 - blur / (height * 0.0016));
  const glowAlpha = sharpness * (el.accent >= 0 ? 0.5 : 0.34);
  const glowRadius = Math.max(height * 0.0009, px * 0.5);

  const { hw, hh } = geometryExtent(el, px, minThickness);
  const pad = Math.ceil(2.6 * Math.max(glowAlpha > 0.01 ? glowRadius : 0, blur)) + 3;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(hw * 2 + pad * 2);
  canvas.height = Math.ceil(hh * 2 + pad * 2);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.fillStyle = rgbCss(
    el.accent >= 0 ? palette.accents[el.accent] : sampleRamp(palette, el.colorT),
  );
  ctx.globalCompositeOperation = "lighter";

  if (glowAlpha > 0.01) {
    ctx.filter = `blur(${glowRadius.toFixed(2)}px)`;
    ctx.globalAlpha = glowAlpha;
    drawGeometry(ctx, el, px, minThickness);
  }

  ctx.globalAlpha = 1;
  ctx.filter = blur > 0.08 ? `blur(${blur.toFixed(2)}px)` : "none";
  drawGeometry(ctx, el, px, minThickness);

  return { canvas, hw: canvas.width / 2, hh: canvas.height / 2 };
};

const cache = new Map<string, Sprite[]>();

/** Sprites are built once per (palette, height) and reused for every frame. */
export const getSprites = (
  key: string,
  els: Debris[],
  palette: Palette,
  height: number,
): Sprite[] => {
  const cacheKey = `${key}@${height}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const built = els.map((el) => buildSprite(el, palette, height));
  cache.set(cacheKey, built);
  return built;
};
