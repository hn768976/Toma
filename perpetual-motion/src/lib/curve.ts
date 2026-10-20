export type V3 = [number, number, number];

/** A Catmull–Rom curve through control points, `per` samples per span. */
export function catmull(points: V3[], per: number): V3[] {
  const out: V3[] = [];
  const p = [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const c = (k: number) => 0.5 * (2 * p[i][k] + (-p[i - 1][k] + p[i + 1][k]) * t + (2 * p[i - 1][k] - 5 * p[i][k] + 4 * p[i + 1][k] - p[i + 2][k]) * t2 + (-p[i - 1][k] + 3 * p[i][k] - 3 * p[i + 1][k] + p[i + 2][k]) * t3);
      out.push([c(0), c(1), c(2)]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export function lengths(points: V3[]): number[] {
  const s = [0];
  for (let i = 1; i < points.length; i++) s.push(s[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]));
  return s;
}

/** 2D convex hull (monotone chain). */
export function hull(points: [number, number][]): [number, number][] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
