/**
 * Offscreen sprite construction and blitting.
 *
 * The rule this module exists to enforce: a shape is rasterised ONCE, at the
 * largest size it will ever be drawn, and afterwards only ever blitted with a
 * transform. Re-pathing a few hundred translucent polygons per frame is what
 * makes a canvas field slow; blitting is what makes it fast.
 *
 * Sprites carry the scale they were rasterised at, so the blit can always
 * work out a downscale factor and never guess.
 */

export type Sprite = {
  canvas: HTMLCanvasElement;
  /** The size multiplier the sprite was rasterised at. */
  scale: number;
};

export const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
};

/** `#RRGGBB` to a canvas `rgba()` string. */
export const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export type PathFn = (ctx: CanvasRenderingContext2D) => void;
export type PaintFn = (ctx: CanvasRenderingContext2D) => void;

/**
 * Rasterises one closed path, centred, at `scale`.
 *
 * `shapeW`/`shapeH` are the path's bounds in base units; the canvas is grown
 * by the stroke width so the outline is never clipped. `paint` receives a
 * context with the path already built and `lineWidth` already set, so callers
 * choose fill, stroke or both without restating the geometry.
 */
export const rasterisePath = (
  path: PathFn,
  shapeW: number,
  shapeH: number,
  stroke: number,
  scale: number,
  paint: PaintFn,
): Sprite => {
  const pad = stroke + 4;
  const canvas = createCanvas((shapeW + pad * 2) * scale, (shapeH + pad * 2) * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke;
  path(ctx);
  paint(ctx);
  return { canvas, scale };
};

/** A soft radial dot — the usual building block for motes, sparks and bokeh. */
export const rasteriseGlow = (
  radius: number,
  color: string,
  stops: readonly [number, number][] = [
    [0, 1],
    [0.16, 0.75],
    [0.45, 0.16],
    [1, 0],
  ],
): Sprite => {
  const canvas = createCanvas(radius * 2, radius * 2);
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    radius,
    radius,
    0,
    radius,
    radius,
    radius,
  );
  for (const [offset, alpha] of stops) {
    gradient.addColorStop(offset, hexToRgba(color, alpha));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, radius * 2, radius * 2);
  return { canvas, scale: 1 };
};

/**
 * Blits a sprite centred on the current transform origin.
 * `widthMul` stretches the short axis only, which buys shape variety without
 * rasterising another sprite.
 */
export const blitSprite = (
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  sizeMul: number,
  widthMul = 1,
) => {
  const s = sizeMul / sprite.scale;
  const w = sprite.canvas.width * s * widthMul;
  const h = sprite.canvas.height * s;
  ctx.drawImage(sprite.canvas, -w / 2, -h / 2, w, h);
};
