/**
 * Catmull-Rom spline traced onto a 2D context as cubic beziers.
 *
 * Takes a sparse list of control points and produces a curve that passes
 * through every one of them smoothly, which is what makes a handful of seeded
 * points read as a deliberate contour rather than a polyline. Supports closed
 * rings so the same helper covers both open contours and closed loops.
 */
export type Pt = {x: number; y: number};

export const catmullRomPath = (
  ctx: CanvasRenderingContext2D | Path2D,
  points: readonly Pt[],
  closed = false,
  /** 0 = uniform/loose, 1 = tight. 0.5 is the usual centripetal-ish feel. */
  tension = 0.5,
) => {
  const n = points.length;
  if (n < 2) return;

  const at = (i: number): Pt => {
    if (closed) return points[((i % n) + n) % n];
    return points[Math.max(0, Math.min(n - 1, i))];
  };

  ctx.moveTo(points[0].x, points[0].y);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const k = tension / 3;
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) * k,
      p1.y + (p2.y - p0.y) * k,
      p2.x - (p3.x - p1.x) * k,
      p2.y - (p3.y - p1.y) * k,
      p2.x,
      p2.y,
    );
  }
  if (closed) ctx.closePath();
};
