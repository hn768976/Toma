import { getLength, getPointAtLength } from "@remotion/paths";
import { getStroke } from "perfect-freehand";
import { range } from "./random";

export type Pt = [number, number];

/** A centre-line stroke, resampled evenly, with a pressure per point (0.5 = nominal width). */
export type Stroke = {
  pts: Pt[];
  pressure: number[];
  size: number;
  /** Feeds perfect-freehand's thinning: how much pressure changes the width. */
  thinning?: number;
  /** Square-ish ends (a chalk stick's flat end) instead of round caps. */
  flat?: boolean;
  /** Taper length at the end (a brush lifting off), composition units. */
  taperEnd?: number;
  /** Also fill the area the line encloses (a solid arrow head). */
  solid?: boolean;
};

const fmt = (n: number) => Math.round(n * 100) / 100;

/** Catmull-Rom through the points, written as an SVG cubic path. */
export const smoothPath = (pts: Pt[], tension = 1): string => {
  if (pts.length < 2) return "";
  let d = `M ${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += ` C ${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
};

export const polyPath = (pts: Pt[]): string =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"} ${fmt(p[0])} ${fmt(p[1])}`).join(" ");

/** Evenly spaced points along an SVG path, measured with @remotion/paths. */
export const samplePath = (d: string, spacing: number): Pt[] => {
  const len = getLength(d);
  if (len < 1) {
    const p = getPointAtLength(d, 0)!;
    return [
      [p.x, p.y],
      [p.x + 0.5, p.y],
    ];
  }
  const n = Math.max(2, Math.ceil(len / spacing) + 1);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = getPointAtLength(d, Math.min(len - 1e-3, (len * i) / (n - 1)))!;
    out.push([p.x, p.y]);
  }
  return out;
};

export const pathLength = (d: string) => getLength(d);

/** Smooth a list of control points into an evenly sampled centre line. */
export const smoothLine = (ctrl: Pt[], spacing = 6, tension = 1): Pt[] =>
  samplePath(smoothPath(ctrl, tension), spacing);

/** Pressure that swells at both ends, like a pressed chalk stroke. */
export const pressedEnds = (n: number, mid = 0.5, ends = 0.72, reach = 0.07): number[] =>
  Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    const bump = Math.max(Math.exp(-((t / reach) ** 2)), Math.exp(-(((1 - t) / reach) ** 2)));
    return mid + (ends - mid) * bump;
  });

/** Heavy start, long dry tail: a loaded brush. */
export const brushPressure = (n: number, rng: () => number): number[] => {
  const start = range(rng, 0.85, 0.98);
  const mid = range(rng, 0.6, 0.7);
  const tailFrom = range(rng, 0.62, 0.8);
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    const head = start + (mid - start) * Math.min(1, t / 0.14) ** 0.7;
    const tail = t > tailFrom ? ((t - tailFrom) / (1 - tailFrom)) ** 1.4 : 0;
    const wob = 0.06 * Math.sin(t * 17 + start * 40) + 0.04 * Math.sin(t * 41 + start * 13);
    return Math.max(0.08, head - (head - 0.12) * tail + wob);
  });
};

/** Uneven marker pressure for a closed outline. */
export const unevenPressure = (n: number, rng: () => number, lo = 0.42, hi = 0.68): number[] => {
  const f1 = range(rng, 1.5, 3.5);
  const f2 = range(rng, 5, 9);
  const p1 = rng() * 6.28;
  const p2 = rng() * 6.28;
  return Array.from({ length: n }, (_, i) => {
    const t = i / Math.max(1, n - 1);
    const v = 0.5 + 0.32 * Math.sin(6.283 * f1 * t + p1) + 0.18 * Math.sin(6.283 * f2 * t + p2);
    return lo + (hi - lo) * Math.min(1, Math.max(0, v));
  });
};

/**
 * One boil variant: the same line moved by a smooth seeded offset field
 * (a slow wave plus a faster, smaller one), so it reads as a redraw, not noise.
 */
export const jitterPts = (pts: Pt[], amp: number, rng: () => number): Pt[] => {
  const f1 = range(rng, 0.5, 1.3);
  const f2 = range(rng, 1.8, 3.4);
  const ph = Array.from({ length: 4 }, () => rng() * Math.PI * 2);
  const n = pts.length;
  // Cumulative length so the wave follows arc length, not point index.
  const acc: number[] = [0];
  for (let i = 1; i < n; i++) {
    acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = acc[n - 1] || 1;
  return pts.map((p, i) => {
    const t = acc[i] / total;
    const dx = amp * (0.7 * Math.sin(2 * Math.PI * (f1 * t) + ph[0]) + 0.3 * Math.sin(2 * Math.PI * (f2 * t) + ph[1]));
    const dy = amp * (0.7 * Math.sin(2 * Math.PI * (f1 * t) + ph[2]) + 0.3 * Math.sin(2 * Math.PI * (f2 * t) + ph[3]));
    return [p[0] + dx, p[1] + dy] as Pt;
  });
};

/**
 * The hand in the base drawing (same for every variant): a small tremor in the line and
 * pressure that rises and falls along it, so no stroke is an even-width spline.
 */
export const handDrawn = (s: Stroke, tremor: number, rng: () => number): Stroke => {
  const f = [range(rng, 2.5, 4.5), range(rng, 6, 11)];
  const ph = Array.from({ length: 4 }, () => rng() * Math.PI * 2);
  const pf = range(rng, 1.2, 2.6);
  const pp = rng() * Math.PI * 2;
  const n = s.pts.length;
  const pts = s.pts.map(([x, y], i) => {
    const t = i / Math.max(1, n - 1);
    return [
      x + tremor * (0.7 * Math.sin(2 * Math.PI * f[0] * t + ph[0]) + 0.3 * Math.sin(2 * Math.PI * f[1] * t + ph[1])),
      y + tremor * (0.7 * Math.sin(2 * Math.PI * f[0] * t + ph[2]) + 0.3 * Math.sin(2 * Math.PI * f[1] * t + ph[3])),
    ] as Pt;
  });
  const pressure = s.pressure.map((p, i) => {
    const t = i / Math.max(1, n - 1);
    return Math.min(1, Math.max(0.05, p + 0.13 * Math.sin(2 * Math.PI * pf * t + pp) + 0.05 * Math.sin(2 * Math.PI * 3.7 * pf * t + 2 * pp)));
  });
  return { ...s, pts, pressure };
};

/** A stroke redrawn for one variant: jittered points, slightly different pressure/taper. */
export const variantStroke = (s: Stroke, amp: number, rng: () => number): Stroke => {
  const sizeK = range(rng, 0.97, 1.03);
  const pk = range(rng, 0.94, 1.06);
  const pShift = range(rng, -0.04, 0.04);
  return {
    ...s,
    pts: jitterPts(s.pts, amp, rng),
    size: s.size * sizeK,
    pressure: s.pressure.map((p) => Math.min(1, Math.max(0.05, p * pk + pShift))),
  };
};

/** perfect-freehand outline polygon for a (possibly partial) stroke. */
export const outline = (s: Stroke, count = s.pts.length, sizeScale = 1): Pt[] => {
  const k = Math.max(1, Math.min(count, s.pts.length));
  const input = s.pts.slice(0, k).map((p, i) => [p[0], p[1], s.pressure[i]]);
  if (input.length === 1) input.push([input[0][0] + 0.01, input[0][1] + 0.01, input[0][2]]);
  return getStroke(input, {
    size: s.size * sizeScale,
    thinning: s.thinning ?? 0.6,
    smoothing: 0.6,
    streamline: 0.2,
    simulatePressure: false,
    last: true,
    start: { cap: !s.flat, taper: 0 },
    end: { cap: !s.flat, taper: s.taperEnd ?? 0 },
  }) as Pt[];
};

export const toPath2D = (polys: Pt[][]): Path2D => {
  const p = new Path2D();
  for (const poly of polys) {
    if (poly.length < 3) continue;
    p.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) p.lineTo(poly[i][0], poly[i][1]);
    p.closePath();
  }
  return p;
};

export const transformPts = (pts: Pt[], s: number, rot: number, tx: number, ty: number): Pt[] => {
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  return pts.map(([x, y]) => [tx + s * (x * c - y * sn), ty + s * (x * sn + y * c)] as Pt);
};

export type BBox = { x: number; y: number; w: number; h: number };

export const bboxOf = (pts: Pt[], pad: number): BBox => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
};
