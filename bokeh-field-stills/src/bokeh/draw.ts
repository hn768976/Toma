import { CONFIG } from "./config";
import { BokehElement } from "./elements";
import { rgba } from "./color";

export type Ctx2D = CanvasRenderingContext2D;

export const createBuffer = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  return canvas;
};

/**
 * How strongly the bokeh rim shows, given the blur the band will receive.
 * Sharp marks get 0 (a rim on a sharp rectangle would just look like a
 * gradient); the softest marks get the full donut.
 */
export const rimStrength = (blur: number, scale: number) => {
  const onset = CONFIG.bokeh.rimOnsetBlur * scale;
  const max = CONFIG.depth.blurMax * scale;
  if (blur <= onset) return 0;
  return Math.max(0, Math.min(1, (blur - onset) / Math.max(max - onset, 1e-6)));
};

/**
 * Draws one rectangle with a radial ramp that is marginally brighter at 80%
 * of its extent than at its centre. Once the band buffer is blurred this
 * spreads into the classic bokeh donut instead of a flat soft blob.
 *
 * The gradient is built in a unit circle and then squashed by the rect's own
 * aspect, so a 6:1 dash gets a 6:1 elliptical ramp rather than a round one.
 */
const fillWithRim = (
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  centre: string,
  mid: string,
  edge: string,
) => {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(Math.max(w / 2, 1e-3), Math.max(h / 2, 1e-3));
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, centre);
  gradient.addColorStop(0.55, mid);
  gradient.addColorStop(CONFIG.bokeh.rimStop, color);
  gradient.addColorStop(1, edge);
  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
};

/**
 * Paints a set of elements into a buffer with additive compositing, so
 * overlapping marks pool into hot regions instead of occluding one another.
 * `offset` shifts everything into the buffer's padded coordinate space.
 */
export const paintElements = (
  ctx: Ctx2D,
  elements: BokehElement[],
  rim: number,
  offset: number,
) => {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(offset, offset);

  for (const element of elements) {
    // Canvas alpha tops out at 1, so an element brighter than opaque is drawn
    // in several equal passes. With 'lighter' the passes sum exactly, so
    // n draws at a/n is identical to one draw at a.
    const passes = Math.max(1, Math.ceil(element.opacity));
    const alpha = element.opacity / passes;
    const base = rgba(element.color, alpha);

    if (rim <= 0) {
      // Fast path: a flat fill is identical to the gradient at rim 0, and this
      // avoids building a gradient object per rectangle for the sharp bands.
      ctx.fillStyle = base;
      for (let pass = 0; pass < passes; pass++) {
        for (const part of element.parts) ctx.fillRect(part.x, part.y, part.w, part.h);
      }
      continue;
    }

    const centre = rgba(element.color, alpha * (1 - CONFIG.bokeh.centreDim * rim));
    const mid = rgba(element.color, alpha * (1 - CONFIG.bokeh.midDim * rim));
    const edge = rgba(element.color, alpha * (1 - CONFIG.bokeh.edgeDim * rim));
    for (let pass = 0; pass < passes; pass++) {
      for (const part of element.parts) {
        fillWithRim(ctx, part.x, part.y, part.w, part.h, base, centre, mid, edge);
      }
    }
  }

  ctx.restore();
};

/** Composites a padded buffer back over the frame, blurring it exactly once. */
export const compositeBuffer = (
  ctx: Ctx2D,
  buffer: HTMLCanvasElement,
  blur: number,
  offset: number,
  alpha = 1,
) => {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  if (blur > 0.25) ctx.filter = `blur(${blur.toFixed(2)}px)`;
  ctx.drawImage(buffer, -offset, -offset);
  ctx.restore();
};
