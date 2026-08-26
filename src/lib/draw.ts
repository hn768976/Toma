import {random} from 'remotion';
import type {Mat} from './mat';
import {apply} from './mat';

/* ------------------------------------------------------------------ colour */

/** Parses a `#rrggbb` token from the theme into its components. */
const parseHex = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** `rgba()` string from a theme token plus an alpha. */
export const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Linear mix of two theme tokens, returned as an `rgba()` string. */
export const mix = (a: string, b: string, t: number, alpha = 1): string => {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const l = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgba(${l(r1, r2)},${l(g1, g2)},${l(b1, b2)},${alpha})`;
};

/** Pushes a token toward white by `t`, keeping it in `rgba()` form. */
export const lighten = (hex: string, t: number, alpha = 1): string => {
  const [r, g, b] = parseHex(hex);
  const l = (x: number) => Math.round(x + (255 - x) * t);
  return `rgba(${l(r)},${l(g)},${l(b)},${alpha})`;
};

/* ------------------------------------------------------ seeded randomness */

/** Remotion's deterministic `random()`. Math.random() is never used anywhere. */
export const rnd = (seed: string): number => random(seed);

export const rrange = (seed: string, lo: number, hi: number): number =>
  lo + random(seed) * (hi - lo);

export const rint = (seed: string, lo: number, hi: number): number =>
  Math.floor(lo + random(seed) * (hi - lo + 1));

export const rpick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

/* ------------------------------------------------------------ loop safety */

export const DURATION = 372;

/** Frame index folded into [0, DURATION). */
export const loopFrame = (frame: number): number =>
  ((frame % DURATION) + DURATION) % DURATION;

/**
 * Every periodic motion in the piece goes through here. `freq` is forced to an
 * integer and the phase is taken on the folded frame, so frame 372 evaluates to
 * exactly the same double as frame 0 rather than to sin(2*pi*k), which is only
 * approximately zero.
 */
export const closedSine = (frame: number, freq: number, phase = 0): number =>
  Math.sin((loopFrame(frame) / DURATION) * Math.PI * 2 * Math.round(freq) + phase);

export const closedCosine = (frame: number, freq: number, phase = 0): number =>
  Math.cos((loopFrame(frame) / DURATION) * Math.PI * 2 * Math.round(freq) + phase);

/** Divisors of 372 that are long enough to read as travel rather than strobe. */
export const TRAVEL_PERIODS = [62, 93, 124, 186] as const;

/**
 * Phase in [0, 1) of a travelling pulse whose period divides `DURATION`, so
 * the cycle closes exactly at the loop point.
 */
export const travelPhase = (frame: number, period: number, offset: number): number => {
  const p = ((loopFrame(frame) % period) / period + offset) % 1;
  return p < 0 ? p + 1 : p;
};

/* ------------------------------------------------------------------ paths */

/** Rounded rectangle path. `roundRect` is available in the render browser. */
export const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
};

export type Pt = {x: number; y: number};

/** Cumulative-length polyline that can be sampled by normalised distance. */
export type Polyline = {
  pts: Pt[];
  cum: number[];
  length: number;
};

export const makePolyline = (pts: Pt[]): Polyline => {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  return {pts, cum, length: cum[cum.length - 1] || 1};
};

/** Point at normalised distance `t` along the polyline. */
export const pointAt = (line: Polyline, t: number): Pt => {
  const target = Math.max(0, Math.min(1, t)) * line.length;
  const {cum, pts} = line;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const midIdx = (lo + hi) >> 1;
    if (cum[midIdx] <= target) lo = midIdx;
    else hi = midIdx;
  }
  const span = cum[hi] - cum[lo] || 1;
  const k = (target - cum[lo]) / span;
  return {
    x: pts[lo].x + (pts[hi].x - pts[lo].x) * k,
    y: pts[lo].y + (pts[hi].y - pts[lo].y) * k,
  };
};

export const strokePolyline = (ctx: CanvasRenderingContext2D, line: Polyline): void => {
  const {pts} = line;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
};

/**
 * Sub-path covering [t0, t1] of a polyline — used to draw the bright travelling
 * segment of a pulse without re-stroking the whole strand.
 */
export const strokePolylineRange = (
  ctx: CanvasRenderingContext2D,
  line: Polyline,
  t0: number,
  t1: number
): void => {
  const a = Math.max(0, Math.min(1, t0));
  const b = Math.max(0, Math.min(1, t1));
  if (b <= a) return;
  const start = pointAt(line, a);
  const end = pointAt(line, b);
  const loA = a * line.length;
  const hiA = b * line.length;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < line.pts.length; i++) {
    if (line.cum[i] > loA && line.cum[i] < hiA) ctx.lineTo(line.pts[i].x, line.pts[i].y);
  }
  ctx.lineTo(end.x, end.y);
};

/**
 * Right-angle route between two points with rounded corners, sampled into a
 * polyline. Circuit-trace style: axis-aligned runs only, never a diagonal.
 */
export const orthoRoute = (from: Pt, to: Pt, bias: number, radius: number): Polyline => {
  const midX = from.x + (to.x - from.x) * bias;
  const corners: Pt[] = [from, {x: midX, y: from.y}, {x: midX, y: to.y}, to];
  const out: Pt[] = [corners[0]];
  for (let i = 1; i < corners.length - 1; i++) {
    const prev = corners[i - 1];
    const cur = corners[i];
    const next = corners[i + 1];
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r < 1) {
      out.push(cur);
      continue;
    }
    const inUx = (cur.x - prev.x) / (inLen || 1);
    const inUy = (cur.y - prev.y) / (inLen || 1);
    const outUx = (next.x - cur.x) / (outLen || 1);
    const outUy = (next.y - cur.y) / (outLen || 1);
    const a = {x: cur.x - inUx * r, y: cur.y - inUy * r};
    const b = {x: cur.x + outUx * r, y: cur.y + outUy * r};
    const STEPS = 6;
    for (let s = 0; s <= STEPS; s++) {
      const k = s / STEPS;
      // Quadratic through the corner keeps the fillet tangent to both runs.
      const om = 1 - k;
      out.push({
        x: om * om * a.x + 2 * om * k * cur.x + k * k * b.x,
        y: om * om * a.y + 2 * om * k * cur.y + k * k * b.y,
      });
    }
  }
  out.push(corners[corners.length - 1]);
  return makePolyline(out);
};

/* ------------------------------------------------------------------ misc */

/** Axis-aligned bounding box of a rect's pre-image under `m`. */
export const inverseBounds = (
  inv: Mat,
  w: number,
  h: number,
  pad: number
): {minX: number; minY: number; maxX: number; maxY: number} => {
  const corners = [
    {x: -pad, y: -pad},
    {x: w + pad, y: -pad},
    {x: w + pad, y: h + pad},
    {x: -pad, y: h + pad},
  ].map((p) => apply(inv, p));
  return {
    minX: Math.min(...corners.map((p) => p.x)),
    minY: Math.min(...corners.map((p) => p.y)),
    maxX: Math.max(...corners.map((p) => p.x)),
    maxY: Math.max(...corners.map((p) => p.y)),
  };
};

/** Allocates a plain 2D canvas of the given backing-store size. */
export const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

export const ctxOf = (c: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
};
