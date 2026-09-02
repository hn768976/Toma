/**
 * Smooth polyline construction and traversal for canvas drawing.
 *
 * Curves are authored as a handful of anchor points and expanded into a
 * dense polyline through a centripetal Catmull-Rom spline, which passes
 * through every anchor and never overshoots into cusps the way a naive
 * uniform Catmull-Rom does. The dense form is what tapered strokes and
 * travelling highlights need: both work in arc-length space.
 *
 * @example
 * const path = catmullRomPath([{x:0,y:0},{x:300,y:200},{x:900,y:60}], 240);
 * const p = pointAtArc(path, 0.5);   // halfway along by distance
 */

export type Pt = { x: number; y: number };

export type Path = {
  pts: Pt[];
  /** Cumulative arc length at each point; last entry is the total. */
  arc: number[];
  length: number;
};

/**
 * Expands anchors into `samples` points along a centripetal Catmull-Rom
 * spline. Endpoints are extrapolated so the curve starts and ends exactly
 * on the first and last anchor.
 */
export const catmullRomPath = (anchors: Pt[], samples: number): Path => {
  if (anchors.length < 2) {
    const only = anchors[0] ?? { x: 0, y: 0 };
    return { pts: [only, only], arc: [0, 0], length: 0 };
  }
  const ext: Pt[] = [
    {
      x: anchors[0].x * 2 - anchors[1].x,
      y: anchors[0].y * 2 - anchors[1].y,
    },
    ...anchors,
    {
      x: anchors[anchors.length - 1].x * 2 - anchors[anchors.length - 2].x,
      y: anchors[anchors.length - 1].y * 2 - anchors[anchors.length - 2].y,
    },
  ];

  const segs = anchors.length - 1;
  const per = Math.max(2, Math.round(samples / segs));
  const pts: Pt[] = [];

  for (let s = 0; s < segs; s++) {
    const p0 = ext[s];
    const p1 = ext[s + 1];
    const p2 = ext[s + 2];
    const p3 = ext[s + 3];
    // Centripetal parameterisation (alpha = 0.5).
    const t01 = Math.pow(Math.hypot(p1.x - p0.x, p1.y - p0.y), 0.5) || 1e-4;
    const t12 = Math.pow(Math.hypot(p2.x - p1.x, p2.y - p1.y), 0.5) || 1e-4;
    const t23 = Math.pow(Math.hypot(p3.x - p2.x, p3.y - p2.y), 0.5) || 1e-4;

    const m1x = ((p2.x - p1.x) + t12 * ((p1.x - p0.x) / t01 - (p2.x - p0.x) / (t01 + t12)));
    const m1y = ((p2.y - p1.y) + t12 * ((p1.y - p0.y) / t01 - (p2.y - p0.y) / (t01 + t12)));
    const m2x = ((p2.x - p1.x) + t12 * ((p3.x - p2.x) / t23 - (p3.x - p1.x) / (t12 + t23)));
    const m2y = ((p2.y - p1.y) + t12 * ((p3.y - p2.y) / t23 - (p3.y - p1.y) / (t12 + t23)));

    const last = s === segs - 1;
    const steps = last ? per : per - 1;
    for (let i = 0; i <= steps; i++) {
      const t = last ? i / steps : i / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      pts.push({
        x: h00 * p1.x + h10 * m1x + h01 * p2.x + h11 * m2x,
        y: h00 * p1.y + h10 * m1y + h01 * p2.y + h11 * m2y,
      });
    }
  }

  const arc: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    arc.push(arc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return { pts, arc, length: arc[arc.length - 1] };
};

/** Index of the last point at or before arc-length fraction `t` (0..1). */
export const indexAtArc = (path: Path, t: number): number => {
  const target = Math.max(0, Math.min(1, t)) * path.length;
  let lo = 0;
  let hi = path.arc.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (path.arc[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

/** Interpolated point at arc-length fraction `t` (0..1). */
export const pointAtArc = (path: Path, t: number): Pt => {
  const i = indexAtArc(path, t);
  const j = Math.min(path.pts.length - 1, i + 1);
  const span = path.arc[j] - path.arc[i];
  const local = span > 0 ? (Math.max(0, Math.min(1, t)) * path.length - path.arc[i]) / span : 0;
  return {
    x: path.pts[i].x + (path.pts[j].x - path.pts[i].x) * local,
    y: path.pts[i].y + (path.pts[j].y - path.pts[i].y) * local,
  };
};

/** Translates a whole path by (dx, dy), reusing the arc table. */
export const offsetPath = (path: Path, dx: number, dy: number): Path => ({
  pts: path.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  arc: path.arc,
  length: path.length,
});
