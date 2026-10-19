import { getLength, getPointAtLength, getSubpaths } from "@remotion/paths";
import rough from "roughjs";
import type { Options as RoughOptions } from "roughjs/bin/core";
import { type Rng, range, signed } from "./random";

export type Pt = [number, number];
export type Polyline = Pt[];

/** One pen stroke: a polyline plus an optional weight multiplier. */
export type StrokeDef = {
  pts: Polyline;
  /** Multiplies the pen size (1 = default). */
  weight?: number;
  /** Opacity of this stroke (highlighter swipes). */
  alpha?: number;
};
export type Drawing = StrokeDef[];

export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, s: number): Pt => [a[0] * s, a[1] * s];
export const len = (a: Pt) => Math.hypot(a[0], a[1]);
export const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const polar = (r: number, ang: number): Pt => [Math.cos(ang) * r, Math.sin(ang) * r];
export const rot = (p: Pt, ang: number): Pt => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};

export const polyLength = (pts: Polyline) => {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
};

/** Cumulative arc length at each vertex. */
export const cumulative = (pts: Polyline) => {
  const out = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) {
    out[i] = out[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return out;
};

/** Point at arc length s along a polyline (binary search on cumulative lengths). */
export const pointAt = (pts: Polyline, cum: Float64Array, s: number): Pt => {
  const L = cum[cum.length - 1];
  if (s <= 0) return pts[0];
  if (s >= L) return pts[pts.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < s) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  return lerp(pts[lo], pts[hi], (s - cum[lo]) / seg);
};

/** Resample a polyline at (roughly) even spacing. */
export const resample = (pts: Polyline, spacing: number): Polyline => {
  if (pts.length < 2) return pts;
  const cum = cumulative(pts);
  const L = cum[cum.length - 1];
  const n = Math.max(2, Math.ceil(L / spacing));
  const out: Polyline = [];
  for (let i = 0; i <= n; i++) out.push(pointAt(pts, cum, (L * i) / n));
  return out;
};

export const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 40): Polyline => {
  const out: Polyline = [];
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

export const quad = (p0: Pt, c: Pt, p1: Pt, n = 30): Polyline =>
  cubic(p0, lerp(p0, c, 2 / 3), lerp(p1, c, 2 / 3), p1, n);

/** Centripetal-ish Catmull-Rom spline through control points. */
export const spline = (ctrl: Polyline, perSeg = 16): Polyline => {
  if (ctrl.length < 3) return ctrl.length === 2 ? resample(ctrl, len(sub(ctrl[1], ctrl[0])) / perSeg) : ctrl;
  const out: Polyline = [];
  const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[i + 2];
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

/**
 * A hand-drawn ellipse: starts at a random angle, sweeps `sweep` radians
 * (more than 2π overshoots, less leaves a gap) and drifts in radius so it
 * never closes exactly.
 */
export const handEllipse = (
  rng: Rng,
  c: Pt,
  rx: number,
  ry: number,
  opts: { sweep?: number; start?: number; tilt?: number; drift?: number; dir?: 1 | -1 } = {},
): Polyline => {
  const sweep = opts.sweep ?? (rng() < 0.5 ? range(rng, Math.PI * 1.88, Math.PI * 1.97) : range(rng, Math.PI * 2.08, Math.PI * 2.35));
  const start = opts.start ?? range(rng, -2.6, -1.6);
  const tilt = opts.tilt ?? signed(rng, 0.12);
  const drift = opts.drift ?? range(rng, 0.06, 0.14);
  const dir = opts.dir ?? -1;
  const n = Math.max(40, Math.round((sweep * Math.max(rx, ry)) / 6));
  const wob1 = range(rng, 0, Math.PI * 2);
  const wob2 = range(rng, 0, Math.PI * 2);
  const out: Polyline = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = start + dir * sweep * t;
    // radius drifts outwards over the loop, plus two slow wobbles
    const k = 1 + drift * (t - 0.5) + 0.04 * Math.sin(a * 2 + wob1) + 0.02 * Math.sin(a * 3 + wob2);
    out.push(add(c, rot([Math.cos(a) * rx * k, Math.sin(a) * ry * k], tilt)));
  }
  return out;
};

/** A slightly bowed, wobbling hand line from a to b. */
export const handLine = (rng: Rng, a: Pt, b: Pt, opts: { bow?: number; wobble?: number } = {}): Polyline => {
  const d = sub(b, a);
  const L = len(d);
  const nrm: Pt = [-d[1] / (L || 1), d[0] / (L || 1)];
  const bow = (opts.bow ?? signed(rng, 0.03)) * L;
  const wob = opts.wobble ?? Math.min(3.5, L * 0.006);
  const ph = range(rng, 0, Math.PI * 2);
  const fr = range(rng, 1.5, 3.2);
  const n = Math.max(8, Math.round(L / 8));
  const out: Polyline = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = bow * 4 * t * (1 - t) + wob * Math.sin(t * Math.PI * fr + ph) * Math.sin(Math.PI * t);
    out.push(add(lerp(a, b, t), mul(nrm, off)));
  }
  return out;
};

/** Low-frequency normal displacement along a polyline (hand tremor). */
export const tremor = (rng: Rng, pts: Polyline, amp: number, waves = 3): Polyline => {
  if (pts.length < 3 || amp === 0) return pts;
  const cum = cumulative(pts);
  const L = cum[cum.length - 1] || 1;
  const comps = Array.from({ length: waves }, (_, i) => ({
    f: range(rng, 0.6, 1.4) * (i + 1) * Math.max(1, L / 400),
    ph: range(rng, 0, Math.PI * 2),
    w: 1 / (i + 1),
  }));
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const d = sub(b, a);
    const l = len(d) || 1;
    const u = cum[i] / L;
    let off = 0;
    for (const c of comps) off += c.w * Math.sin(u * Math.PI * 2 * c.f + c.ph);
    return add(p, mul([-d[1] / l, d[0] / l], off * amp));
  });
};

export const transform = (pts: Polyline, o: { x?: number; y?: number; s?: number; r?: number; sx?: number; sy?: number }): Polyline =>
  pts.map((p) => {
    const q = rot([p[0] * (o.sx ?? o.s ?? 1), p[1] * (o.sy ?? o.s ?? 1)], o.r ?? 0);
    return [q[0] + (o.x ?? 0), q[1] + (o.y ?? 0)];
  });

export const placeDrawing = (d: Drawing, o: Parameters<typeof transform>[1]): Drawing =>
  d.map((s) => ({ ...s, pts: transform(s.pts, o) }));

export const bounds = (d: Drawing) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of d)
    for (const [x, y] of s.pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};

// ---------------------------------------------------------------------------
// @remotion/paths: SVG path data -> pen polylines
// ---------------------------------------------------------------------------

const pathCache = new Map<string, Polyline[]>();

/** Each subpath of an SVG `d` string, sampled with @remotion/paths. */
export const pathToPolylines = (d: string, spacing = 6): Polyline[] => {
  const key = `${spacing}|${d}`;
  const hit = pathCache.get(key);
  if (hit) return hit;
  const out: Polyline[] = [];
  for (const sp of getSubpaths(d)) {
    const L = getLength(sp);
    if (L < 0.5) continue;
    const n = Math.max(2, Math.ceil(L / spacing));
    const pts: Polyline = [];
    for (let i = 0; i <= n; i++) {
      const p = getPointAtLength(sp, (L * i) / n);
      if (p) pts.push([p.x, p.y]);
    }
    out.push(pts);
  }
  pathCache.set(key, out);
  return out;
};

// ---------------------------------------------------------------------------
// Rough.js: sketchy geometry -> pen polylines
// ---------------------------------------------------------------------------

const generator = rough.generator();

type RoughOp = { op: "move" | "bcurveTo" | "lineTo"; data: number[] };
type RoughSet = { type: string; ops: RoughOp[] };

/** Rough op sets -> SVG subpath strings, one per pen-down ("move"). */
const opsToSubpaths = (sets: RoughSet[], kinds: string[]): string[] => {
  const out: string[] = [];
  for (const set of sets) {
    if (!kinds.includes(set.type)) continue;
    let cur = "";
    for (const { op, data } of set.ops) {
      if (op === "move") {
        if (cur) out.push(cur);
        cur = `M${data[0]} ${data[1]}`;
      } else if (op === "bcurveTo") {
        cur += ` C${data[0]} ${data[1]} ${data[2]} ${data[3]} ${data[4]} ${data[5]}`;
      } else {
        cur += ` L${data[0]} ${data[1]}`;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
};

/**
 * Join pen strokes whose start lands where the previous one ended, so a
 * Rough.js shape drawn segment by segment becomes one continuous line.
 */
export const joinContinuous = (lines: Polyline[], tol: number): Polyline[] => {
  const out: Polyline[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (prev && len(sub(prev[prev.length - 1], l[0])) < tol) out[out.length - 1] = [...prev, ...l.slice(1)];
    else out.push(l);
  }
  return out;
};

export type RoughKind =
  | { kind: "linearPath"; pts: Pt[] }
  | { kind: "polygon"; pts: Pt[] }
  | { kind: "rectangle"; x: number; y: number; w: number; h: number }
  | { kind: "ellipse"; x: number; y: number; w: number; h: number }
  | { kind: "path"; d: string }
  | { kind: "line"; a: Pt; b: Pt };

const roughCache = new Map<string, Polyline[]>();

/**
 * Sketchy outline (and optional hachure) from Rough.js, as pen polylines.
 * `seed` must be >= 1: Rough.js falls back to Math.random() for seed 0.
 */
export const roughStrokes = (
  shape: RoughKind,
  seed: number,
  opts: RoughOptions & { join?: number; spacing?: number } = {},
): Polyline[] => {
  const key = JSON.stringify([shape, seed, opts]);
  const hit = roughCache.get(key);
  if (hit) return hit;
  const o: RoughOptions = { roughness: 1, bowing: 1, ...opts, seed: Math.max(1, seed >>> 0) % 2147483646 || 1 };
  let drawable;
  switch (shape.kind) {
    case "linearPath":
      drawable = generator.linearPath(shape.pts, o);
      break;
    case "polygon":
      drawable = generator.polygon(shape.pts, o);
      break;
    case "rectangle":
      drawable = generator.rectangle(shape.x, shape.y, shape.w, shape.h, o);
      break;
    case "ellipse":
      drawable = generator.ellipse(shape.x, shape.y, shape.w, shape.h, o);
      break;
    case "path":
      drawable = generator.path(shape.d, o);
      break;
    case "line":
      drawable = generator.line(shape.a[0], shape.a[1], shape.b[0], shape.b[1], o);
      break;
  }
  const subpaths = opsToSubpaths(drawable.sets as unknown as RoughSet[], ["path", "fillSketch"]);
  const lines = subpaths.flatMap((d) => pathToPolylines(d, opts.spacing ?? 6));
  const out = opts.join ? joinContinuous(lines, opts.join) : lines;
  roughCache.set(key, out);
  return out;
};
