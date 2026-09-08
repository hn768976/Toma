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
import { toPlane } from "./geo";
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

export const routePathData = (route: RouteDef, g: MapGeometry): string => {
  const pts = route.pts.map(([lon, lat]) => toPlane(lon, lat, g));
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
