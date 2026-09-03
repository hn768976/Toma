/**
 * Small pool of offscreen canvases, keyed by purpose and size.
 *
 * Allocating a canvas is expensive and a 4K backing store is ~33MB, so effects
 * that need a scratch surface reuse one per (key, size) instead of creating one
 * per frame. Contents are never assumed to survive between frames.
 */
const pool = new Map<string, HTMLCanvasElement>();

export const scratchCanvas = (
  key: string,
  width: number,
  height: number,
): HTMLCanvasElement => {
  const id = `${key}:${width}x${height}`;
  const existing = pool.get(id);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  pool.set(id, canvas);
  return canvas;
};

export const scratchContext = (
  key: string,
  width: number,
  height: number,
): CanvasRenderingContext2D => {
  const ctx = scratchCanvas(key, width, height).getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return ctx;
};
