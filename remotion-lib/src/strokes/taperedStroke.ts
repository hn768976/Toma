/**
 * taperedStroke — width and alpha falling off along a path.
 *
 * WHAT: Strokes a polyline as a series of short segments whose width and alpha
 * are driven by position along the path, so a stroke can start wide and opaque
 * and end at nothing.
 *
 * WHY: Canvas has no native variable-width stroke. A constant-width line has a
 * blunt end that reads as a drawn mark rather than a moving thing — a comet
 * with a rectangular tail, a lightning fork that stops dead. Tapering is what
 * makes a trail read as motion and a branch read as thinning toward its tip.
 *
 * HOW: Each segment is stroked separately at its own width and alpha. Segments
 * are drawn with round caps and a small overlap so the joins do not show as
 * notches. This is more draw calls than a single stroke, which is why
 * `maxSegments` exists — beyond a few hundred the eye cannot tell, and the cost
 * is real at 4K.
 *
 * PARAMETERS
 *   ctx          Target context.
 *   points       The polyline, in order. Fewer than 2 points draws nothing.
 *   color        Stroke colour. Required — nothing is baked in.
 *   startWidth   Width in px at the head of the path. Default 6.
 *   endWidth     Width in px at the tail. Default 0 — a true point.
 *   startAlpha   Alpha at the head. Default 1.
 *   endAlpha     Alpha at the tail. Default 0.
 *   easing       Remaps normalised position before it drives width and alpha.
 *                Default is linear. Pass `(t) => t * t` for a fast early
 *                falloff, which is what a comet tail wants.
 *   maxSegments  Cap on drawn segments; the polyline is sampled down to this.
 *                Default 240.
 *   additive     Composite with 'lighter'. Default false. Set true when the
 *                taper is a light trail rather than a drawn stroke.
 *
 * GOTCHA: because each segment is a separate stroke, a semi-transparent taper
 * over itself will show seams where segments overlap. Either keep alpha high,
 * or use `additive: true` where the overlap reads as extra brightness instead
 * of as a seam.
 *
 * EXAMPLE
 *   taperedStroke({
 *     ctx,
 *     points: trail,
 *     color: '#7FD4FF',
 *     startWidth: 8,
 *     easing: (t) => t * t,
 *     additive: true,
 *   });
 */
import type { Ctx, Point } from '../types';

export type TaperedStrokeOptions = {
  ctx: Ctx;
  points: readonly Point[];
  color: string;
  startWidth?: number;
  endWidth?: number;
  startAlpha?: number;
  endAlpha?: number;
  easing?: (t: number) => number;
  maxSegments?: number;
  additive?: boolean;
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const taperedStroke = ({
  ctx,
  points,
  color,
  startWidth = 6,
  endWidth = 0,
  startAlpha = 1,
  endAlpha = 0,
  easing = (t) => t,
  maxSegments = 240,
  additive = false,
}: TaperedStrokeOptions): void => {
  if (points.length < 2) return;

  // Sample the polyline down to at most `maxSegments` segments. The first and
  // last points are always kept so the taper spans the whole path.
  const segCount = Math.min(maxSegments, points.length - 1);
  const step = (points.length - 1) / segCount;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (additive) ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;

  for (let i = 0; i < segCount; i++) {
    const a = points[Math.round(i * step)];
    const b = points[Math.round((i + 1) * step)];
    if (!a || !b) continue;

    // Width and alpha are sampled at the segment MIDPOINT rather than at its
    // start, so a two-segment taper is still symmetric about its centre.
    const t = easing((i + 0.5) / segCount);
    const w = lerp(startWidth, endWidth, t);
    const alpha = lerp(startAlpha, endAlpha, t);
    if (w <= 0.05 || alpha <= 0.004) continue;

    ctx.globalAlpha = alpha;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.restore();
};
