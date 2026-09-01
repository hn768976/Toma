/**
 * drawOn — a stroke that draws itself on, via dash offset.
 *
 * WHAT: Computes the `lineDash` / `lineDashOffset` pair that reveals a path
 * progressively, and applies it to a context. Also exports the SVG equivalent
 * for `stroke-dasharray` / `stroke-dashoffset`.
 *
 * WHY: The dash trick is the only way to reveal a stroke along its own length
 * without clipping. A clip rectangle reveals in screen space, so a curved path
 * appears from behind a moving straight edge, which reads wrong. The dash
 * approach follows the path itself.
 *
 * HOW: set one dash as long as the whole path, then slide the offset. At
 * progress 0 the dash is entirely offset out of view; at 1 it fully covers the
 * path.
 *
 * PARAMETERS
 *   length     Total path length in px. For canvas you must measure or compute
 *              this yourself; for SVG use `path.getTotalLength()`.
 *   progress   0..1. Values outside are clamped.
 *   reverse    Draw from the far end instead. Default false.
 *
 * GOTCHA: this OVERWRITES any dash pattern on the context. A path that is both
 * dashed and draws on needs the dashes baked into the geometry instead — you
 * cannot have two dash patterns at once.
 *
 * GOTCHA: `length` must be the real path length. If you guess it low the stroke
 * finishes early and then sits still; if you guess high it never quite
 * completes. For canvas polylines, sum the segment lengths.
 *
 * EXAMPLE
 *   applyDrawOn(ctx, { length: pathLength, progress: frame / 60 });
 *   ctx.stroke(myPath);
 */
import type { Ctx } from '../types';

export type DrawOnOptions = {
  length: number;
  progress: number;
  reverse?: boolean;
};

export type DashState = {
  /** Feed to ctx.setLineDash(...) or SVG stroke-dasharray. */
  dash: [number, number];
  /** Feed to ctx.lineDashOffset or SVG stroke-dashoffset. */
  offset: number;
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Computes the dash/offset pair without touching a context. */
export const drawOn = ({
  length,
  progress,
  reverse = false,
}: DrawOnOptions): DashState => {
  const p = clamp01(progress);
  const shown = length * p;
  return {
    dash: [length, length],
    offset: reverse ? shown - length : length - shown,
  };
};

/** Applies a draw-on state to a canvas context. Stroke after calling. */
export const applyDrawOn = (ctx: Ctx, options: DrawOnOptions): void => {
  const { dash, offset } = drawOn(options);
  ctx.setLineDash(dash);
  ctx.lineDashOffset = offset;
};

/** Sums the segment lengths of a polyline, for use as `length`. */
export const polylineLength = (
  points: readonly { x: number; y: number }[],
): number => {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
};
