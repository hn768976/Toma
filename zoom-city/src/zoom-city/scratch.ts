/**
 * Reusable offscreen canvases.
 *
 * The heavy passes (reflection, bloom) work on a downscaled copy of the field
 * — a blur that is about to be scaled back up does not need 4K pixels — and
 * these buffers are allocated once per page rather than once per frame.
 */

const canvases = new Map<string, HTMLCanvasElement>();

export const scratch = (key: string, width: number, height: number) => {
  const existing = canvases.get(key);
  if (existing && existing.width === width && existing.height === height) {
    const ctx = existing.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
      ctx.clearRect(0, 0, width, height);
    }
    return existing;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvases.set(key, canvas);
  return canvas;
};
