/**
 * Render something at a fraction of the target resolution and blow it
 * back up with high-quality smoothing.
 *
 * For content that is all soft gradient — mottling, glow pools — the
 * upscale *is* the blur, and it costs 1/64th of the fill rate at 1/8
 * scale. Anything with an edge in it should not go through here.
 */
export const makeCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

export const lowResUpscale = (
  target: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
): void => {
  target.save();
  target.imageSmoothingEnabled = true;
  target.imageSmoothingQuality = "high";
  target.drawImage(source, 0, 0, width, height);
  target.restore();
};

/**
 * Paint into a `divisor`-times-smaller canvas and return it, ready to be
 * blitted up with `lowResUpscale`.
 */
export const paintLowRes = (
  width: number,
  height: number,
  divisor: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): HTMLCanvasElement => {
  const small = makeCanvas(width / divisor, height / divisor);
  const ctx = small.getContext("2d");
  if (ctx) {
    paint(ctx, small.width, small.height);
  }
  return small;
};
