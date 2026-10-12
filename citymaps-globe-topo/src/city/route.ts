// Sampling the closed tracker route. Everything is periodic in arc length,
// so any smoothing window wraps cleanly and the loop stays seamless.

import { Route, V2 } from "./generate";

export const routePoint = (r: Route, s: number): V2 => {
  const L = r.length;
  let t = s % L;
  if (t < 0) t += L;
  // binary search the segment
  let lo = 0;
  let hi = r.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (r.cum[mid] <= t) lo = mid;
    else hi = mid;
  }
  const a = r.pts[lo];
  const b = r.pts[hi];
  const seg = r.cum[hi] - r.cum[lo] || 1;
  const u = (t - r.cum[lo]) / seg;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
};

// Box-filtered position over [s - half, s + half].
export const routeSmooth = (r: Route, s: number, half: number, n = 24): V2 => {
  let x = 0;
  let y = 0;
  for (let i = 0; i <= n; i++) {
    const p = routePoint(r, s - half + (2 * half * i) / n);
    x += p.x;
    y += p.y;
  }
  return { x: x / (n + 1), y: y / (n + 1) };
};

export const routeHeading = (r: Route, s: number, half: number) => {
  const a = routePoint(r, s - half);
  const b = routePoint(r, s + half);
  return Math.atan2(b.y - a.y, b.x - a.x);
};

export const angleDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

// Camera state that follows the dot: smoothed centre, and a small rotation
// that leans into turns (short-window heading vs long-window heading).
export const followCamera = (r: Route, s: number) => {
  const center = routeSmooth(r, s, 110, 32);
  let rot = 0;
  const K = 8;
  for (let k = -K; k <= K; k++) {
    const ss = s + k * 12;
    rot += angleDiff(routeHeading(r, ss, 25), routeHeading(r, ss, 220));
  }
  rot /= 2 * K + 1;
  return { center, rot: Math.max(-0.3, Math.min(0.3, rot * 0.3)) };
};
