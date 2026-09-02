/**
 * Disc erosion and dilation of an alpha mask, using only canvas compositing.
 *
 * Eroding by r is the intersection of the mask with copies of itself shifted r
 * in every direction; dilating is the union of the same copies. Approximating
 * the disc with a ring of directions gives a result that is smooth enough for
 * a soft-edged glow at 4K, needs no pixel loops, and — unlike stroking the
 * source path — is correct for shapes built as a union of overlapping
 * primitives, where interior boundaries must not be treated as edges.
 *
 * These run once per shape in a useMemo, never per frame.
 */

import { TAU } from "../constants";
import { createLayer } from "./canvas";

const DIRECTIONS = 24;

const shiftedCopies = (
  source: HTMLCanvasElement,
  radius: number,
  composite: GlobalCompositeOperation,
): HTMLCanvasElement => {
  const { canvas, ctx } = createLayer(source.width, source.height);
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = composite;
  for (let i = 0; i < DIRECTIONS; i++) {
    const a = (TAU * i) / DIRECTIONS;
    ctx.drawImage(source, Math.cos(a) * radius, Math.sin(a) * radius);
  }
  return canvas;
};

/** Shrinks the mask inward by `radius` pixels. */
export const erodeMask = (source: HTMLCanvasElement, radius: number) =>
  shiftedCopies(source, radius, "destination-in");

/** Grows the mask outward by `radius` pixels. */
export const dilateMask = (source: HTMLCanvasElement, radius: number) =>
  shiftedCopies(source, radius, "source-over");

/** `a` with `b` punched out of it. */
export const subtractMask = (
  a: HTMLCanvasElement,
  b: HTMLCanvasElement,
): HTMLCanvasElement => {
  const { canvas, ctx } = createLayer(a.width, a.height);
  ctx.drawImage(a, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(b, 0, 0);
  return canvas;
};

/**
 * Reads a mask's coverage into a low-resolution Float32Array in [0, 1].
 * Downsampling through drawImage gives smoothly antialiased coverage, which is
 * exactly what the shimmer wants for "how far inside the shape am I".
 */
export const maskCoverage = (
  source: HTMLCanvasElement,
  size: number,
): Float32Array => {
  const { canvas, ctx } = createLayer(size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const out = new Float32Array(size * size);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3] / 255;
  void canvas;
  return out;
};
