// Tracking-shot motion: a dot driving a closed route in exactly LOOP frames,
// slowing at corners, and a lagging, slowly turning camera. Everything is a
// periodic function of (frame mod LOOP), precomputed once.
import { CITY, LOOP, type Route } from './index';

export interface TrackSample { x: number; y: number; heading: number; speed: number; s: number }
export interface Track {
  route: Route;
  dot: TrackSample[]; // per frame, LOOP entries
  cam: { x: number; y: number; rot: number }[];
}

const SUB = 4; // sub-samples per frame for smoothing

function build(route: Route): Track {
  const P = route.pts;
  const n = P.length / 2;
  // cumulative arc length
  const S: number[] = [0];
  for (let i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]));
  const L = S[n - 1];
  // corners: turn angle at each vertex (closed loop: vertex 0 == vertex n-1)
  const corners: { s: number; sev: number }[] = [];
  const dir = (i: number) => {
    const a = ((i % (n - 1)) + (n - 1)) % (n - 1);
    const b = a + 1;
    return Math.atan2(P[b * 2 + 1] - P[a * 2 + 1], P[b * 2] - P[a * 2]);
  };
  for (let i = 0; i < n - 1; i++) {
    let d = dir(i) - dir(i - 1);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const sev = Math.min(1, Math.abs(d) / (Math.PI / 2));
    if (Math.abs(d) > 0.2) corners.push({ s: S[i], sev });
  }
  // speed profile on a 1 m grid, time = integral ds / v
  const ds = 1;
  const m = Math.ceil(L / ds);
  const T = new Float64Array(m + 1);
  const vAt = (s: number) => {
    let f = 1;
    for (const c of corners) {
      let d = Math.abs(s - c.s);
      d = Math.min(d, L - d);
      if (d < 120) f -= 0.62 * c.sev * Math.exp(-((d / 38) ** 2));
    }
    return Math.max(0.3, f);
  };
  for (let i = 1; i <= m; i++) T[i] = T[i - 1] + ds / vAt((i - 0.5) * ds);
  const total = T[m];
  const posAt = (s: number) => {
    s = ((s % L) + L) % L;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid] <= s) lo = mid; else hi = mid; }
    const f = (s - S[lo]) / Math.max(1e-9, S[hi] - S[lo]);
    return { x: P[lo * 2] + (P[hi * 2] - P[lo * 2]) * f, y: P[lo * 2 + 1] + (P[hi * 2 + 1] - P[lo * 2 + 1]) * f, h: Math.atan2(P[hi * 2 + 1] - P[lo * 2 + 1], P[hi * 2] - P[lo * 2]) };
  };
  // invert time table
  const N = LOOP * SUB;
  const samples: { x: number; y: number; h: number; s: number }[] = [];
  let j = 0;
  for (let q = 0; q < N; q++) {
    const t = (q / N) * total;
    while (j < m && T[j + 1] < t) j++;
    const f = (t - T[j]) / Math.max(1e-12, T[j + 1] - T[j]);
    const s = (j + f) * ds;
    const p = posAt(s);
    samples.push({ ...p, s });
  }
  const at = (q: number) => samples[((q % N) + N) % N];
  // dot per frame
  const dot: TrackSample[] = [];
  for (let f = 0; f < LOOP; f++) {
    const a = at(f * SUB), b = at(f * SUB + 1);
    const sp = Math.hypot(b.x - a.x, b.y - a.y) * SUB; // metres per frame
    dot.push({ x: a.x, y: a.y, heading: a.h, speed: sp, s: a.s / L });
  }
  // camera position: exponentially weighted average of the past (lag)
  const tau = 9 * SUB;
  const camPos: { x: number; y: number }[] = [];
  for (let f = 0; f < LOOP; f++) {
    let sx = 0, sy = 0, sw = 0;
    for (let k = 0; k < tau * 5; k++) {
      const w = Math.exp(-k / tau);
      const p = at(f * SUB - k);
      sx += p.x * w; sy += p.y * w; sw += w;
    }
    camPos.push({ x: sx / sw, y: sy / sw });
  }
  // heavily smoothed heading (gaussian on unit vectors, periodic)
  const sig = 70 * SUB;
  const hs: number[] = [];
  for (let f = 0; f < LOOP; f++) {
    let cx = 0, cy = 0;
    for (let k = -3 * sig; k <= 3 * sig; k += 2) {
      const w = Math.exp(-((k / sig) ** 2) / 2);
      const p = at(f * SUB + k), p2 = at(f * SUB + k + 1);
      const dx = p2.x - p.x, dy = p2.y - p.y, l = Math.hypot(dx, dy);
      if (l > 1e-9) { cx += (dx / l) * w; cy += (dy / l) * w; }
    }
    hs.push(Math.atan2(cy, cx));
  }
  const U: number[] = [hs[0]];
  for (let f = 1; f <= LOOP; f++) {
    let d = hs[f % LOOP] - hs[f - 1 < LOOP ? f - 1 : 0];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    U.push(U[f - 1] + d);
  }
  const wind = U[LOOP] - U[0]; // multiple of 2*pi
  const det = (f: number) => U[f] - (wind * f) / LOOP; // periodic
  let mean = 0;
  for (let f = 0; f < LOOP; f++) mean += det(f);
  mean /= LOOP;
  // map turns gently with the route (partial follow), periodic over the loop
  const cam = camPos.map((p, f) => ({ ...p, rot: -(det(f) - mean) * 0.35 }));
  return { route, dot, cam };
}

let cache: Track | null = null;
export function getTrack(): Track {
  if (!cache) cache = build(CITY.routes[0]);
  return cache;
}
