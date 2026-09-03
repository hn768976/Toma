import {makeCanvas} from "./use-canvas";

/**
 * A rasterised alpha mask of an arbitrary shape, plus an O(1) point-in-shape
 * test.
 *
 * Testing tens of thousands of candidate points against a complex vector path
 * with `isPointInPath` is far too slow to do even once; rasterising the shape a
 * single time and reading its alpha channel turns each test into one array
 * lookup. The mask canvas is kept around afterwards so drawing operations can
 * be clipped to the same shape with a `destination-in` composite.
 */
export type MaskField = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** True when the pixel at (x, y) is inside the shape. */
  contains: (x: number, y: number) => boolean;
};

export const createMaskField = (
  width: number,
  height: number,
  drawShape: (ctx: CanvasRenderingContext2D) => void,
  alphaThreshold = 128,
): MaskField => {
  const {canvas, ctx} = makeCanvas(width, height);
  ctx.fillStyle = "#ffffff";
  drawShape(ctx);

  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  const bits = new Uint8Array(w * h);
  for (let i = 0, p = 3; i < bits.length; i++, p += 4) {
    bits[i] = data[p] >= alphaThreshold ? 1 : 0;
  }

  return {
    canvas,
    width: w,
    height: h,
    contains: (x: number, y: number) => {
      const ix = x | 0;
      const iy = y | 0;
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) return false;
      return bits[iy * w + ix] === 1;
    },
  };
};
