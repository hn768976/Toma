export type Pt = { x: number; y: number };

/**
 * Smooth open curve through every point (Catmull-Rom converted to cubic
 * Béziers). Used for sparklines and the scrolling telemetry waves.
 */
export const smoothPath = (pts: Pt[], tension = 1): string => {
  if (pts.length < 2) return "";
  const d: string[] = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const k = tension / 6;
    const c1 = { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k };
    const c2 = { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k };
    d.push(
      `C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)} ${c2.x.toFixed(2)} ${c2.y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    );
  }
  return d.join(" ");
};

/** Cubic Bézier evaluated at `t`, for riding packets along an edge. */
export const cubicAt = (p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: number): Pt => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
  };
};

/** Tangent angle of a cubic Bézier at `t`, in degrees. */
export const cubicAngleAt = (
  p0: Pt,
  c1: Pt,
  c2: Pt,
  p1: Pt,
  t: number,
): number => {
  const u = 1 - t;
  const dx =
    3 * u * u * (c1.x - p0.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (p1.x - c2.x);
  const dy =
    3 * u * u * (c1.y - p0.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (p1.y - c2.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
};

/**
 * Horizontal S-curve between two points — the shape every edge in the
 * execution graph uses, so packets and strokes agree on the geometry.
 */
export const sCurve = (from: Pt, to: Pt, bow = 0.5) => {
  const dx = (to.x - from.x) * bow;
  return {
    p0: from,
    c1: { x: from.x + dx, y: from.y },
    c2: { x: to.x - dx, y: to.y },
    p1: to,
    d: `M ${from.x} ${from.y} C ${from.x + dx} ${from.y} ${to.x - dx} ${to.y} ${to.x} ${to.y}`,
  };
};
