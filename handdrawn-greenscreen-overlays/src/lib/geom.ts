// Hand-made geometry: nothing here is geometrically perfect. Every shape gets
// seeded wobble, uneven sizes and open ends.
import { Rng, range, signed } from './random';

export type Pt = [number, number];

export const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const polyLength = (pts: Pt[]) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
};

export const cumulative = (pts: Pt[]) => {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i - 1], pts[i]));
  return c;
};

/** Point at arc length s along a polyline with precomputed cumulative lengths. */
export const pointAtLength = (pts: Pt[], cum: number[], s: number): Pt => {
  if (s <= 0) return pts[0];
  const L = cum[cum.length - 1];
  if (s >= L) return pts[pts.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  return lerpPt(pts[lo], pts[hi], (s - cum[lo]) / seg);
};

/** Re-sample a polyline at a fixed spacing. */
export const resample = (pts: Pt[], step: number): Pt[] => {
  const cum = cumulative(pts);
  const L = cum[cum.length - 1];
  const n = Math.max(2, Math.ceil(L / step) + 1);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) out.push(pointAtLength(pts, cum, (L * i) / (n - 1)));
  return out;
};

/**
 * Sideways hand drift: one slow sag/bow over the whole stroke plus
 * non-periodic wander from random control points at irregular spacing
 * (cubic-smoothed). No sine waves, so nothing repeats evenly.
 */
export const wobble = (pts: Pt[], r: Rng, amp: number, wavelength = 900): Pt[] => {
  const dense = resample(pts, 6);
  const cum = cumulative(dense);
  const L = cum[cum.length - 1] || 1;
  // irregular knots
  const knots: { s: number; v: number }[] = [{ s: 0, v: signed(r, amp * 0.6) }];
  while (knots[knots.length - 1].s < L) {
    const step = wavelength * range(r, 0.3, 1.25);
    knots.push({ s: knots[knots.length - 1].s + step, v: signed(r, amp) * (r() < 0.25 ? 1.6 : 1) });
  }
  const sag = signed(r, amp * 1.4) * Math.min(1, L / 1500);
  const noise = (s: number) => {
    let i = 0;
    while (i < knots.length - 2 && knots[i + 1].s < s) i++;
    const k0 = knots[Math.max(0, i - 1)].v, k1 = knots[i].v, k2 = knots[i + 1].v, k3 = knots[Math.min(knots.length - 1, i + 2)].v;
    const t = (s - knots[i].s) / (knots[i + 1].s - knots[i].s);
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * k1 + (-k0 + k2) * t + (2 * k0 - 5 * k1 + 4 * k2 - k3) * t2 + (-k0 + 3 * k1 - 3 * k2 + k3) * t3);
  };
  return dense.map((p, i) => {
    const a = dense[Math.max(0, i - 1)];
    const b = dense[Math.min(dense.length - 1, i + 1)];
    const len = dist(a, b) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const u = cum[i] / L;
    const o = noise(cum[i]) + sag * Math.sin(Math.PI * u);
    return [p[0] + nx * o, p[1] + ny * o] as Pt;
  });
};

export const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 64): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
};

/** Catmull-Rom spline through control points. */
export const spline = (ctrl: Pt[], perSeg = 24): Pt[] => {
  const out: Pt[] = [];
  const P = (i: number) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
};

/** A hand line from a to b: slight bow, wobble, and a little overshoot or undershoot. */
export const handLine = (a: Pt, b: Pt, r: Rng, wob = 5): Pt[] => {
  const L = dist(a, b);
  const dx = (b[0] - a[0]) / L;
  const dy = (b[1] - a[1]) / L;
  const bow = signed(r, L * 0.022) + Math.sign(r() - 0.5) * L * 0.012;
  const a2: Pt = [a[0] + signed(r, 6), a[1] + signed(r, 6)];
  const ext = range(r, -0.015, 0.03) * L;
  const b2: Pt = [b[0] + dx * ext, b[1] + dy * ext];
  const mid1: Pt = [lerp(a2[0], b2[0], 0.33) - dy * bow, lerp(a2[1], b2[1], 0.33) + dx * bow];
  const mid2: Pt = [lerp(a2[0], b2[0], 0.66) - dy * bow * 0.8, lerp(a2[1], b2[1], 0.66) + dx * bow * 0.8];
  return wobble(cubic(a2, mid1, mid2, b2, 48), r, wob, 700);
};

/**
 * A hand ellipse that doesn't quite close: random start angle, a sweep a bit
 * short of or past a full turn, radius drift (slight spiral) and wobble.
 */
export const handEllipse = (
  c: Pt,
  rx: number,
  ry: number,
  rot: number,
  r: Rng,
  o: { sweep?: number; drift?: number; wob?: number; dir?: 1 | -1 } = {},
): Pt[] => {
  const start = range(r, 0, Math.PI * 2);
  const sweep = o.sweep ?? Math.PI * 2 + range(r, -0.28, 0.42);
  const drift = o.drift ?? range(r, 0.04, 0.09);
  const dir = o.dir ?? -1;
  const n = 140;
  const squash = range(r, -0.1, 0.1);
  // lopsided: an egg bias towards one side, and a flat-ish side where the wrist turns
  const eggA = range(r, 0, Math.PI * 2);
  const egg = range(r, 0.05, 0.12);
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = start + dir * sweep * t;
    const k = 1 + drift * (t - 0.5) + squash * Math.sin(2 * a) + egg * Math.cos(a - eggA);
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    pts.push([c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return wobble(pts, r, o.wob ?? 6, 800);
};

/** Arrowhead as one pen stroke: barb -> tip -> barb, uneven sides and angles. */
export const arrowHead = (tip: Pt, dir: number, size: number, r: Rng): Pt[] => {
  const a1 = dir + Math.PI - range(r, 0.42, 0.62);
  const a2 = dir + Math.PI + range(r, 0.38, 0.6);
  const l1 = size * range(r, 0.85, 1.12);
  const l2 = size * range(r, 0.78, 1.05);
  const t2: Pt = [tip[0] + signed(r, 5), tip[1] + signed(r, 5)];
  const b1: Pt = [tip[0] + Math.cos(a1) * l1, tip[1] + Math.sin(a1) * l1];
  const b2: Pt = [t2[0] + Math.cos(a2) * l2, t2[1] + Math.sin(a2) * l2];
  return [...handLine(b1, tip, r, 2), ...handLine(t2, b2, r, 2).slice(1)];
};

/**
 * Arrowheads the way different people draw them, as pen strokes:
 * 0 one-stroke V, 1 two separate barbs flicked into the tip,
 * 2 open triangle in one loop (overshooting its start), 3 V with one long hooked barb.
 */
export const arrowHeads = (tip: Pt, dir: number, size: number, r: Rng, style: number): Pt[][] => {
  const a1 = dir + Math.PI - range(r, 0.36, 0.66);
  const a2 = dir + Math.PI + range(r, 0.34, 0.64);
  const l1 = size * range(r, 0.75, 1.2);
  const l2 = size * range(r, 0.65, 1.1);
  const b1: Pt = [tip[0] + Math.cos(a1) * l1, tip[1] + Math.sin(a1) * l1];
  const b2: Pt = [tip[0] + Math.cos(a2) * l2, tip[1] + Math.sin(a2) * l2];
  const t2: Pt = [tip[0] + signed(r, 6), tip[1] + signed(r, 6)];
  switch (style % 4) {
    case 1:
      return [handLine(b1, tip, r, 2), handLine(b2, t2, r, 2)];
    case 2: {
      const back: Pt = [b1[0] + (b2[0] - b1[0]) * 1.08, b1[1] + (b2[1] - b1[1]) * 1.08];
      return [[...handLine(b1, tip, r, 2), ...handLine(t2, b2, r, 2).slice(1), ...handLine(b2, back, r, 1.5).slice(1), ...handLine(back, [b1[0] + signed(r, 8), b1[1] + signed(r, 8)], r, 1.5).slice(1)]];
    }
    case 3: {
      const hookLen = l2 * 1.35;
      const hb: Pt = [t2[0] + Math.cos(a2) * hookLen, t2[1] + Math.sin(a2) * hookLen];
      const bend: Pt = [(t2[0] + hb[0]) / 2 + Math.cos(a2 + Math.PI / 2) * size * 0.18, (t2[1] + hb[1]) / 2 + Math.sin(a2 + Math.PI / 2) * size * 0.18];
      return [[...handLine(b1, tip, r, 2), ...cubic(t2, bend, bend, hb, 24).slice(1)]];
    }
    default:
      return [arrowHead(tip, dir, size, r)];
  }
};

/** Direction at the end of a polyline. */
export const endDir = (pts: Pt[], back = 30): number => {
  const cum = cumulative(pts);
  const L = cum[cum.length - 1];
  const a = pointAtLength(pts, cum, Math.max(0, L - back));
  const b = pts[pts.length - 1];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
};
export const startDir = (pts: Pt[], fwd = 30): number => {
  const cum = cumulative(pts);
  const a = pts[0];
  const b = pointAtLength(pts, cum, fwd);
  return Math.atan2(a[1] - b[1], a[0] - b[0]);
};

/** A wavy line from a to b. */
export const wavyLine = (a: Pt, b: Pt, amp: number, waves: number, r: Rng): Pt[] => {
  const L = dist(a, b);
  const dx = (b[0] - a[0]) / L;
  const dy = (b[1] - a[1]) / L;
  const n = Math.ceil(waves * 24);
  const pts: Pt[] = [];
  const ph = range(r, -0.3, 0.3);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const am = amp * (0.8 + 0.35 * Math.sin(t * 5.3 + ph * 7)) ;
    const o = Math.sin(t * waves * Math.PI * 2 + ph) * am;
    pts.push([a[0] + dx * L * t - dy * o, a[1] + dy * L * t + dx * o]);
  }
  return wobble(pts, r, 4, 900);
};

/** Translate / scale / rotate helpers. */
export const transform = (pts: Pt[], s: number, rot: number, t: Pt, origin: Pt = [0, 0]): Pt[] =>
  pts.map(([x, y]) => {
    const X = (x - origin[0]) * s;
    const Y = (y - origin[1]) * s;
    return [t[0] + X * Math.cos(rot) - Y * Math.sin(rot), t[1] + X * Math.sin(rot) + Y * Math.cos(rot)];
  });
