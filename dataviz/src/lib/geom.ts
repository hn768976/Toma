export type Pt = { x: number; y: number };

export const polylinePath = (pts: readonly Pt[]) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(" ");

/** Cumulative arc lengths of a polyline. */
export const cumLengths = (pts: readonly Pt[]) => {
  const out = [0];
  for (let i = 1; i < pts.length; i++) {
    out.push(out[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return out;
};

/** Point and direction at arc-length fraction t (0..1) along a polyline. */
export const alongPolyline = (pts: readonly Pt[], t: number) => {
  const cum = cumLengths(pts);
  const total = cum[cum.length - 1];
  const target = Math.max(0, Math.min(1, t)) * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const segLen = cum[i] - cum[i - 1] || 1;
  const f = (target - cum[i - 1]) / segLen;
  const a = pts[i - 1];
  const b = pts[i];
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
};

/**
 * Closed Catmull-Rom through points, emitted as cubic beziers. Used for the
 * light-dashboard cursor path, which has to return exactly to its start.
 */
export const closedSpline = (pts: readonly Pt[], tension = 0.5) => {
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n];
  let d = `M${at(0).x.toFixed(3)},${at(0).y.toFixed(3)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: p1.x + ((p2.x - p0.x) * tension) / 6, y: p1.y + ((p2.y - p0.y) * tension) / 6 };
    const c2 = { x: p2.x - ((p3.x - p1.x) * tension) / 6, y: p2.y - ((p3.y - p1.y) * tension) / 6 };
    d += ` C${c1.x.toFixed(3)},${c1.y.toFixed(3)} ${c2.x.toFixed(3)},${c2.y.toFixed(3)} ${p2.x.toFixed(3)},${p2.y.toFixed(3)}`;
  }
  return `${d} Z`;
};

/** Sample a closed Catmull-Rom spline at u in 0..1 (wraps). */
export const onClosedSpline = (pts: readonly Pt[], u: number, tension = 0.5): Pt => {
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n];
  const s = ((u % 1) + 1) % 1;
  const scaled = s * n;
  const i = Math.floor(scaled);
  const t = scaled - i;
  const p0 = at(i - 1);
  const p1 = at(i);
  const p2 = at(i + 1);
  const p3 = at(i + 2);
  const m1 = { x: ((p2.x - p0.x) * tension) / 2, y: ((p2.y - p0.y) * tension) / 2 };
  const m2 = { x: ((p3.x - p1.x) * tension) / 2, y: ((p3.y - p1.y) * tension) / 2 };
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return {
    x: h00 * p1.x + h10 * m1.x + h01 * p2.x + h11 * m2.x,
    y: h00 * p1.y + h10 * m1.y + h01 * p2.y + h11 * m2.y,
  };
};

/** SVG arc path for a donut/gauge segment. */
export const arcPath = (
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  a0: number,
  a1: number,
) => {
  const p = (r: number, a: number) => ({
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
  });
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const o0 = p(rOuter, a0);
  const o1 = p(rOuter, a1);
  const i1 = p(rInner, a1);
  const i0 = p(rInner, a0);
  return [
    `M${o0.x.toFixed(3)},${o0.y.toFixed(3)}`,
    `A${rOuter},${rOuter} 0 ${large} 1 ${o1.x.toFixed(3)},${o1.y.toFixed(3)}`,
    `L${i1.x.toFixed(3)},${i1.y.toFixed(3)}`,
    `A${rInner},${rInner} 0 ${large} 0 ${i0.x.toFixed(3)},${i0.y.toFixed(3)}`,
    "Z",
  ].join(" ");
};

/** Smooth area/line path through evenly spaced y values. */
export const smoothPath = (pts: readonly Pt[], tension = 0.4) => {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(3)},${pts[0].y.toFixed(3)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = { x: p1.x + ((p2.x - p0.x) * tension) / 3, y: p1.y + ((p2.y - p0.y) * tension) / 3 };
    const c2 = { x: p2.x - ((p3.x - p1.x) * tension) / 3, y: p2.y - ((p3.y - p1.y) * tension) / 3 };
    d += ` C${c1.x.toFixed(3)},${c1.y.toFixed(3)} ${c2.x.toFixed(3)},${c2.y.toFixed(3)} ${p2.x.toFixed(3)},${p2.y.toFixed(3)}`;
  }
  return d;
};
