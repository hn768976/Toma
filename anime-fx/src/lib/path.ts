import type { Pt } from "./math";

export const polyPath = (ctx: CanvasRenderingContext2D | Path2D, pts: Pt[], close = true) => {
  if (!pts.length) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
};

// Smooth closed/open outline from a point list (perfect-freehand style
// quadratic midpoints).
export const smoothPath = (
  ctx: CanvasRenderingContext2D | Path2D,
  pts: Pt[] | number[][],
  close = true,
) => {
  const n = pts.length;
  if (n < 3) return;
  const p = pts as number[][];
  ctx.moveTo((p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2);
  for (let i = 1; i < n - (close ? 0 : 1); i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  if (close) {
    const a = p[0];
    const b = p[1];
    ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    ctx.closePath();
  }
};

// Catmull-Rom resample of an open polyline -> dense points.
export const catmull = (pts: Pt[], segs = 8): Pt[] => {
  if (pts.length < 3) return pts.slice();
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < segs; k++) {
      const t = k / segs;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

export const pathLength = (pts: Pt[]) => {
  let L = 0;
  for (let i = 1; i < pts.length; i++)
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
};

// First fraction t of a polyline, by length.
export const truncatePath = (pts: Pt[], t: number): Pt[] => {
  if (t >= 1) return pts;
  const total = pathLength(pts) * Math.max(0, t);
  const out: Pt[] = [pts[0]];
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (L + seg >= total) {
      const u = seg > 0 ? (total - L) / seg : 0;
      out.push([
        pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u,
        pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u,
      ]);
      return out;
    }
    L += seg;
    out.push(pts[i]);
  }
  return out;
};
