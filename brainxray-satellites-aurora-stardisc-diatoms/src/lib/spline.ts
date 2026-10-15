export type V2 = [number, number];

/** Centripetal-ish uniform Catmull-Rom through pts, sampled densely. */
export const catmull = (pts: V2[], perSeg = 24): V2[] => {
  const out: V2[] = [];
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

/** Closed Catmull-Rom loop. */
export const catmullClosed = (pts: V2[], perSeg = 24): V2[] => {
  const n = pts.length;
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
};

export const polyLength = (pts: V2[]) => {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
};

/** Point at arc-length fraction u in [0,1] (and the unit tangent). */
export const samplePoly = (pts: V2[], cum: number[], u: number): { p: V2; t: V2 } => {
  const L = cum[cum.length - 1];
  const target = Math.max(0, Math.min(L, u * L));
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < target) lo = mid; else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const f = (target - cum[lo]) / seg;
  const a = pts[lo], b = pts[hi];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const dl = Math.hypot(dx, dy) || 1;
  return { p: [a[0] + dx * f, a[1] + dy * f], t: [dx / dl, dy / dl] };
};

export const cumulative = (pts: V2[]) => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
};

/** Resample to n evenly spaced points. */
export const resample = (pts: V2[], n: number): { p: V2[]; t: V2[]; len: number } => {
  const cum = cumulative(pts);
  const p: V2[] = [], t: V2[] = [];
  for (let i = 0; i < n; i++) {
    const s = samplePoly(pts, cum, i / (n - 1));
    p.push(s.p);
    t.push(s.t);
  }
  return { p, t, len: cum[cum.length - 1] };
};
