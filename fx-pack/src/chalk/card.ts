import { applyGrain, CHALK, fillStroke } from "./render";
import { ChalkItem } from "./items";

/**
 * Render a chalk item to its own transparent canvas (for use as a texture).
 * `pxPerUnit` = texture pixels per 4K pixel.
 */
export const renderCard = (item: ChalkItem, pxPerUnit: number, seed: number) => {
  const pad = 30;
  const c = document.createElement("canvas");
  c.width = Math.max(4, Math.ceil((item.w + pad * 2) * pxPerUnit));
  c.height = Math.max(4, Math.ceil((item.h + pad * 2) * pxPerUnit));
  const ctx = c.getContext("2d")!;
  ctx.setTransform(pxPerUnit, 0, 0, pxPerUnit, pad * pxPerUnit, pad * pxPerUnit);
  ctx.fillStyle = CHALK;
  item.strokes.forEach((s, i) => fillStroke(ctx, s.pts, seed * 7919 + i * 31, item.lens[i]));
  applyGrain(ctx, pxPerUnit, [seed * 53, seed * 29]);
  return { canvas: c, w: item.w + pad * 2, h: item.h + pad * 2 };
};
