/**
 * drawOn.ts — reveal a path as though it is being drawn.
 *
 * WHAT IT DOES
 *   Returns the strokeDasharray / strokeDashoffset pair that hides all of
 *   a path at progress 0 and reveals all of it at progress 1.
 *
 * WHAT IT IS FOR
 *   Hand-drawn explainers, signature reveals, HUD elements that write
 *   themselves on, connector arrows that grow toward their target.
 *
 * WHY THIS IS A PURE FUNCTION AND NOT A HOOK
 *   The usual implementation measures the path with getTotalLength()
 *   inside useLayoutEffect and stores it in state. That has two problems
 *   in Remotion specifically. First it is state, so it is not a pure
 *   function of (frame, props) — and Remotion renders frames out of order
 *   across workers, each mounting fresh. Second, and worse, the first
 *   render always has length 0, which sets strokeDasharray to 0 and shows
 *   the path FULLY DRAWN for one frame before the effect corrects it.
 *   Rendered out of order, that flash lands on random frames.
 *
 *   So: pass the length in. Compute it with the helpers below when the
 *   geometry is yours, which it usually is.
 *
 * PARAMETERS
 *   progress    0..1. Clamped.
 *   pathLength  total length of the path in user units.
 *
 * GOTCHA
 *   pathLength must be at least the true length. Too short and the path
 *   finishes drawing early then sits still; too long and it never
 *   completes. When in doubt overestimate by a few percent and pull
 *   `progress` slightly past 1 at the end of the animation.
 *
 * USAGE
 *   const len = quadraticLength(from, control, to);
 *   <path d={d} {...drawOn(progress, len)} />
 */

import type { Point } from "../types";

export type DashProps = {
  strokeDasharray: number;
  strokeDashoffset: number;
};

/**
 * The reveal. One dash the length of the path, offset out of view and
 * slid in as progress rises.
 */
export const drawOn = (progress: number, pathLength: number): DashProps => {
  const clamped = Math.max(0, Math.min(1, progress));
  return {
    strokeDasharray: pathLength,
    strokeDashoffset: pathLength * (1 - clamped),
  };
};

/**
 * Reveals a WINDOW of the path rather than a growing prefix — a comet or
 * a "signal travelling the wire" look. `head` is the leading edge (0..1),
 * `tailFraction` how much of the path stays lit behind it.
 *
 * Uses a three-entry dash pattern: gap before the window, the window, gap
 * after. Unlike drawOn this cannot be expressed with a single offset.
 */
export const drawOnWindow = (
  head: number,
  pathLength: number,
  tailFraction = 0.2,
): { strokeDasharray: string; strokeDashoffset: number } => {
  const clampedHead = Math.max(0, Math.min(1, head));
  const windowLength = Math.max(0, tailFraction) * pathLength;
  const start = Math.max(0, clampedHead * pathLength - windowLength);
  const visible = clampedHead * pathLength - start;
  return {
    strokeDasharray: `0 ${start} ${visible} ${pathLength}`,
    strokeDashoffset: 0,
  };
};

/** Summed segment lengths of an open polyline. */
export const polylineLength = (points: readonly Point[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
};

/**
 * Length of a quadratic bezier, by flattening. A closed form exists but
 * is long and numerically fussy; 32 samples is well under a pixel of
 * error at any size these compositions use.
 */
export const quadraticLength = (
  from: Point,
  control: Point,
  to: Point,
  samples = 32,
): number => {
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    points.push({
      x: mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x,
      y: mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y,
    });
  }
  return polylineLength(points);
};

/**
 * Length of a cubic bezier, by the same flattening approach.
 */
export const cubicLength = (
  from: Point,
  c1: Point,
  c2: Point,
  to: Point,
  samples = 32,
): number => {
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    points.push({
      x:
        mt * mt * mt * from.x +
        3 * mt * mt * t * c1.x +
        3 * mt * t * t * c2.x +
        t * t * t * to.x,
      y:
        mt * mt * mt * from.y +
        3 * mt * mt * t * c1.y +
        3 * mt * t * t * c2.y +
        t * t * t * to.y,
    });
  }
  return polylineLength(points);
};

/** Circumference of a circle, for ring draw-ons. */
export const circleLength = (radius: number): number => 2 * Math.PI * radius;

/** Perimeter of a rounded rectangle, for box draw-ons. */
export const roundedRectLength = (
  width: number,
  height: number,
  radius: number,
): number => {
  const r = Math.min(radius, width / 2, height / 2);
  return 2 * (width - 2 * r) + 2 * (height - 2 * r) + 2 * Math.PI * r;
};
