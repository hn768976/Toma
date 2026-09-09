/**
 * Route geometry.
 *
 * Two-point routes are bowed arcs; three or more points are smoothed through
 * with a Catmull-Rom spline, which is how shipping lanes are kept off the land.
 * Both come out as one cubic-Bezier path string in plane space.
 *
 * Marker position and heading come from `getPointAtLength()` on a detached
 * SVGPathElement — the browser's own arc-length parameterisation, so a marker
 * moves at a constant rate along the curve rather than at a constant rate in
 * the Bezier parameter. The element is created once per path string and cached,
 * and every call is synchronous during render, so frames stay pure.
 */

import type { MapGeometry } from "./geo";
// explicit extension so the bake/check scripts can import this straight through
// Node's TypeScript stripping, not only through the bundler
import { toPlane } from "./geo.ts";
import type { RouteDef } from "./types";

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/** Cubic bow between two points, deflected toward the nearer pole. */
const arcPath = (
  a: [number, number],
  b: [number, number],
  bend: number,
  poleward: number,
): string => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  // unit normal, then flipped so the bow leans toward the pole like a great circle
  let nx = -dy / len;
  let ny = dx / len;
  if (ny * poleward > 0) {
    nx = -nx;
    ny = -ny;
  }
  const off = bend * len;
  const c1x = a[0] + dx / 3 + nx * off;
  const c1y = a[1] + dy / 3 + ny * off;
  const c2x = a[0] + (dx * 2) / 3 + nx * off;
  const c2y = a[1] + (dy * 2) / 3 + ny * off;
  return `M${fmt(a[0])},${fmt(a[1])}C${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(b[0])},${fmt(b[1])}`;
};

/** Catmull-Rom through the waypoints, converted to cubic Beziers. */
const splinePath = (pts: [number, number][], tension = 0.5): string => {
  let d = `M${fmt(pts[0][0])},${fmt(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2];
    const c1x = p1[0] + ((p2[0] - p0[0]) * tension) / 3;
    const c1y = p1[1] + ((p2[1] - p0[1]) * tension) / 3;
    const c2x = p2[0] - ((p3[0] - p1[0]) * tension) / 3;
    const c2y = p2[1] - ((p3[1] - p1[1]) * tension) / 3;
    d += `C${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(p2[0])},${fmt(p2[1])}`;
  }
  return d;
};

/** Minimum bow a multi-point route must show, as a fraction of its chord. */
const MIN_BOW = 0.1;

/**
 * Waypoints chosen to keep a lane in the water are often close to collinear,
 * and a spline through them renders as a dead straight line — which reads as a
 * ruler stroke laid over the map rather than a route. This bows such a run out
 * to a minimum curvature, in whichever direction it already leans, so it stays
 * on the side of the chord its waypoints chose.
 */
const bowToMinimum = (pts: [number, number][], target: number): [number, number][] => {
  const a = pts[0];
  const b = pts[pts.length - 1];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return pts;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  let extreme = 0;
  for (const p of pts) {
    const off = (p[0] - a[0]) * nx + (p[1] - a[1]) * ny;
    if (Math.abs(off) > Math.abs(extreme)) extreme = off;
  }
  const add = target - Math.abs(extreme) / len;
  if (add <= 0) return pts;
  const sign = extreme >= 0 ? 1 : -1;

  return pts.map(([x, y]) => {
    const t = Math.min(1, Math.max(0, ((x - a[0]) * ux + (y - a[1]) * uy) / len));
    // squared sine rather than sine: the bow builds in the open middle of the
    // run and fades fast at the ends, so the waypoints that were placed to
    // thread a strait or round a headland stay where they were put
    const profile = Math.sin(t * Math.PI) ** 2;
    const k = profile * add * len * sign;
    return [x + nx * k, y + ny * k];
  });
};

/**
 * The route's waypoints in plane space, bowed. Exported so the land check can
 * sample exactly the curve the renderer draws rather than an approximation of
 * it — the two drifting apart is how a lane ends up crossing a coastline with
 * a green check next to it.
 */
export const routePlanePoints = (route: RouteDef, g: MapGeometry): [number, number][] => {
  const pts = route.pts.map(([lon, lat]) => toPlane(lon, lat, g));
  if (pts.length === 2) return pts;
  return bowToMinimum(pts, route.bend ?? MIN_BOW);
};

/** Point at `t` (0..1) along a Catmull-Rom run through `pts`. */
export const sampleSpline = (pts: [number, number][], t: number): [number, number] => {
  const n = pts.length - 1;
  const seg = Math.min(n - 1, Math.floor(t * n));
  const u = t * n - seg;
  const p0 = pts[seg === 0 ? 0 : seg - 1];
  const p1 = pts[seg];
  const p2 = pts[seg + 1];
  const p3 = pts[Math.min(pts.length - 1, seg + 2)];
  const c1x = p1[0] + (p2[0] - p0[0]) / 6;
  const c1y = p1[1] + (p2[1] - p0[1]) / 6;
  const c2x = p2[0] - (p3[0] - p1[0]) / 6;
  const c2y = p2[1] - (p3[1] - p1[1]) / 6;
  const m = 1 - u;
  return [
    m * m * m * p1[0] + 3 * m * m * u * c1x + 3 * m * u * u * c2x + u * u * u * p2[0],
    m * m * m * p1[1] + 3 * m * m * u * c1y + 3 * m * u * u * c2y + u * u * u * p2[1],
  ];
};

export const routePathData = (route: RouteDef, g: MapGeometry): string => {
  const pts = routePlanePoints(route, g);
  if (pts.length === 2) {
    const midLat = (route.pts[0][1] + route.pts[1][1]) / 2;
    // +1 bows upward on screen (northern hemisphere), -1 downward
    return arcPath(pts[0], pts[1], route.bend ?? 0.12, midLat >= 0 ? 1 : -1);
  }
  return splinePath(pts);
};

// ------------------------------------------------------------- measurement

const cache = new Map<string, { el: SVGPathElement; length: number }>();

const measured = (d: string) => {
  let hit = cache.get(d);
  if (!hit) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.setAttribute("d", d);
    // The path stays in a detached <svg>; Chrome still resolves its geometry.
    svg.appendChild(el);
    hit = { el, length: el.getTotalLength() };
    cache.set(d, hit);
  }
  return hit;
};

export const pathLength = (d: string): number => measured(d).length;

export interface OnPath {
  x: number;
  y: number;
  /** Heading in degrees, from the tangent — what the marker is rotated by. */
  angle: number;
}

/** Point and tangent heading at normalised distance `t` (0..1) along the path. */
export const pointAtT = (d: string, t: number): OnPath => {
  const { el, length } = measured(d);
  const clamped = Math.min(1, Math.max(0, t));
  const at = clamped * length;
  const eps = Math.min(length * 0.002, 6) || 1;
  const p = el.getPointAtLength(at);
  const a = el.getPointAtLength(Math.max(0, at - eps));
  const b = el.getPointAtLength(Math.min(length, at + eps));
  return {
    x: p.x,
    y: p.y,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
};

/** A short run of points ending at `t`, used to draw the marker's trail. */
export const trailPoints = (d: string, t: number, lenPx: number, n = 5) => {
  const { el, length } = measured(d);
  const at = Math.min(1, Math.max(0, t)) * length;
  const out: { x: number; y: number }[] = [];
  for (let i = n; i >= 0; i--) {
    const s = at - (lenPx * i) / n;
    const p = el.getPointAtLength(s < 0 ? s + length : s);
    out.push({ x: p.x, y: p.y });
  }
  return out;
};
