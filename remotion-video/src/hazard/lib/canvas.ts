/**
 * Offscreen-canvas helpers.
 *
 * Every scratch surface in this piece is a detached <canvas> created here and
 * kept alive across frames by useMemo, so per-frame work is drawing only —
 * never allocation.
 */

export const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export const context2d = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return ctx;
};

export const createLayer = (
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const canvas = createCanvas(width, height);
  return { canvas, ctx: context2d(canvas) };
};

/** Reset a scratch context to a known state and wipe it. */
export const resetLayer = (ctx: CanvasRenderingContext2D) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
};

/** "#RRGGBB" -> [r, g, b]. The only hex parsing in the project. */
export const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

export const rgba = (rgb: [number, number, number], alpha: number) =>
  `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
