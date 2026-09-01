import { useMemo } from "react";
import type { Matrix } from "./plane";
import { planeMatrix } from "./plane";

/**
 * Depth of field.
 *
 * Elements are bucketed into three offscreen buffers by depth and each buffer
 * is blurred ONCE on the way to the visible canvas. Blurring per element would
 * be unusably slow at 4K.
 *
 * The two soft buffers are kept at half resolution: they are blurred by 11-26px
 * anyway, so the detail is thrown away regardless, and it makes the per-frame
 * cost roughly a quarter of what it would otherwise be.
 */
export const SOFT_RES = 0.5;

/** Blur radii in final-frame pixels. */
export const BLUR = { far: 22, mid: 9, bloom: 24 } as const;

export type Buffer = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Plane -> buffer matrix, already scaled for this buffer's resolution. */
  matrix: Matrix;
  res: number;
};

const makeBuffer = (w: number, h: number, res: number): Buffer => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * res);
  canvas.height = Math.round(h * res);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  return { canvas, ctx, matrix: planeMatrix(w, h, res), res };
};

export type Buffers = {
  far: Buffer;
  mid: Buffer;
  near: Buffer;
  /** Scratch copy of the visible frame, used by the glitch pass. */
  scratch: Buffer;
};

export const useBuffers = (w: number, h: number): Buffers =>
  useMemo(
    () => ({
      far: makeBuffer(w, h, SOFT_RES),
      mid: makeBuffer(w, h, SOFT_RES),
      near: makeBuffer(w, h, 1),
      scratch: makeBuffer(w, h, 1),
    }),
    [w, h],
  );

export const clearBuffer = (b: Buffer): void => {
  b.ctx.setTransform(1, 0, 0, 1, 0, 0);
  b.ctx.clearRect(0, 0, b.canvas.width, b.canvas.height);
};

/** A fresh offscreen canvas for cached, redraw-once content. */
export const makeCache = (w: number, h: number): CanvasRenderingContext2D => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas.getContext("2d") as CanvasRenderingContext2D;
};
