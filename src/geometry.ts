import type {WorkflowData, WorkflowEdgeData, WorkflowNodeData} from './workflows';

export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Card side: ~9% of frame height. */
export const CARD = Math.round(HEIGHT * 0.09); // 194
export const CARD_RADIUS = Math.round(CARD * 0.22);

export type Pt = {x: number; y: number};

/**
 * The plane: one affine transform, rotated ~-8 degrees so it recedes to the
 * upper right, sheared, and compressed ~6% horizontally so the far (right) end
 * of the plane sits closer than it otherwise would.
 *
 * Written as a CSS-style matrix(a, b, c, d, e, f):
 *   xs = a*x + c*y      ys = b*x + d*y
 * (the translation is supplied separately by the camera).
 */
const ROT = (-8 * Math.PI) / 180;
const SHEAR = -0.1;
const COMPRESS = 0.94;

export type Mat = {a: number; b: number; c: number; d: number};

export const PLANE: Mat = (() => {
  const cos = Math.cos(ROT);
  const sin = Math.sin(ROT);
  // R * (skewX * scaleX)
  return {
    a: cos * COMPRESS,
    b: sin * COMPRESS,
    c: cos * SHEAR - sin,
    d: sin * SHEAR + cos,
  };
})();

/** CSS `matrix()` for the linear part of the plane transform. */
export const planeMatrixCss = (m: Mat = PLANE) =>
  `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, 0, 0)`;

/** Plane space -> screen space (origin at the frame centre, plus camera). */
export const toScreen = (p: Pt, origin: Pt, m: Mat = PLANE): Pt => ({
  x: m.a * p.x + m.c * p.y + origin.x,
  y: m.b * p.x + m.d * p.y + origin.y,
});

/* ------------------------------------------------------------------ *
 * Orthogonal routing
 * ------------------------------------------------------------------ */

export type Rect = {x: number; y: number; w: number; h: number};

const nodeRect = (n: WorkflowNodeData, pad: number): Rect => ({
  x: n.x - CARD / 2 - pad,
  y: n.y - CARD / 2 - pad,
  w: CARD + pad * 2,
  h: CARD + pad * 2,
});

/** Axis-aligned segment vs. rect. */
const segmentHitsRect = (p: Pt, q: Pt, r: Rect): boolean => {
  const minX = Math.min(p.x, q.x);
  const maxX = Math.max(p.x, q.x);
  const minY = Math.min(p.y, q.y);
  const maxY = Math.max(p.y, q.y);
  return maxX > r.x && minX < r.x + r.w && maxY > r.y && minY < r.y + r.h;
};

const polylineHitsAny = (pts: Pt[], rects: Rect[]): boolean => {
  for (let i = 0; i < pts.length - 1; i++) {
    for (const r of rects) {
      if (segmentHitsRect(pts[i], pts[i + 1], r)) return true;
    }
  }
  return false;
};

/** Port offsets spread edges across a node's left/right face when it fans. */
const portOffsets = (count: number): number[] => {
  if (count <= 1) return [0];
  const spread = CARD * 0.5;
  return Array.from({length: count}, (_, i) => -spread / 2 + (spread * i) / (count - 1));
};

export type RoutedEdge = {
  key: string;
  from: string;
  to: string;
  /** Orthogonal waypoints in plane space. */
  waypoints: Pt[];
};

/**
 * Right-angle routing: leave the source's right face, run to a vertical
 * corridor, then into the target's left face. Corridor candidates are tried in
 * order so paths route *around* other cards rather than through them.
 */
export const routeEdges = (wf: WorkflowData): RoutedEdge[] => {
  const byId = new Map(wf.nodes.map((n) => [n.id, n]));
  const gap = CARD * 0.16;

  const outIndex = new Map<string, number>();
  const inIndex = new Map<string, number>();
  const outCount = new Map<string, number>();
  const inCount = new Map<string, number>();
  for (const e of wf.edges) {
    outCount.set(e.from, (outCount.get(e.from) ?? 0) + 1);
    inCount.set(e.to, (inCount.get(e.to) ?? 0) + 1);
  }

  return wf.edges.map((e: WorkflowEdgeData) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;

    const oi = outIndex.get(e.from) ?? 0;
    outIndex.set(e.from, oi + 1);
    const ii = inIndex.get(e.to) ?? 0;
    inIndex.set(e.to, ii + 1);

    const sy = a.y + portOffsets(outCount.get(e.from)!)[oi];
    const ey = b.y + portOffsets(inCount.get(e.to)!)[ii];
    const sx = a.x + CARD / 2 + gap;
    const ex = b.x - CARD / 2 - gap;

    const start: Pt = {x: sx, y: sy};
    const end: Pt = {x: ex, y: ey};

    if (Math.abs(sy - ey) < 1) {
      return {key: `${e.from}->${e.to}`, from: e.from, to: e.to, waypoints: [start, end]};
    }

    const obstacles = wf.nodes
      .filter((n) => n.id !== e.from && n.id !== e.to)
      .map((n) => nodeRect(n, CARD * 0.18));

    const fractions = [0.5, 0.36, 0.64, 0.24, 0.76, 0.14, 0.86];
    let chosen = sx + 0.5 * (ex - sx);
    for (const f of fractions) {
      const mx = sx + f * (ex - sx);
      const pts: Pt[] = [start, {x: mx, y: sy}, {x: mx, y: ey}, end];
      if (!polylineHitsAny(pts, obstacles)) {
        chosen = mx;
        break;
      }
    }

    return {
      key: `${e.from}->${e.to}`,
      from: e.from,
      to: e.to,
      waypoints: [start, {x: chosen, y: sy}, {x: chosen, y: ey}, end],
    };
  });
};

/* ------------------------------------------------------------------ *
 * Path construction (rounded right-angle corners)
 * ------------------------------------------------------------------ */

export type Cmd =
  | {t: 'M'; p: Pt}
  | {t: 'L'; p: Pt}
  | {t: 'Q'; c: Pt; p: Pt};

const unit = (from: Pt, to: Pt): Pt => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return {x: dx / len, y: dy / len};
};

/** Turn an orthogonal polyline into a path with rounded corners. */
export const roundedPath = (pts: Pt[], radius: number): Cmd[] => {
  if (pts.length < 2) return [];
  const cmds: Cmd[] = [{t: 'M', p: pts[0]}];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, d1 / 2, d2 / 2);
    const u1 = unit(cur, prev);
    const u2 = unit(cur, next);
    cmds.push({t: 'L', p: {x: cur.x + u1.x * r, y: cur.y + u1.y * r}});
    cmds.push({t: 'Q', c: cur, p: {x: cur.x + u2.x * r, y: cur.y + u2.y * r}});
  }
  cmds.push({t: 'L', p: pts[pts.length - 1]});
  return cmds;
};

/**
 * Béziers are affine-invariant, so transforming the control points transforms
 * the curve exactly — no re-fitting needed.
 */
export const transformCmds = (cmds: Cmd[], origin: Pt, m: Mat = PLANE): Cmd[] =>
  cmds.map((c) => {
    if (c.t === 'Q') return {t: 'Q', c: toScreen(c.c, origin, m), p: toScreen(c.p, origin, m)};
    return {t: c.t, p: toScreen(c.p, origin, m)};
  });

export const cmdsToD = (cmds: Cmd[]): string =>
  cmds
    .map((c) => {
      if (c.t === 'M') return `M ${c.p.x.toFixed(2)} ${c.p.y.toFixed(2)}`;
      if (c.t === 'L') return `L ${c.p.x.toFixed(2)} ${c.p.y.toFixed(2)}`;
      return `Q ${c.c.x.toFixed(2)} ${c.c.y.toFixed(2)} ${c.p.x.toFixed(2)} ${c.p.y.toFixed(2)}`;
    })
    .join(' ');

/* ------------------------------------------------------------------ *
 * Flattening — arc length without touching the DOM, so dash offsets and
 * pulse positions stay deterministic across renders.
 * ------------------------------------------------------------------ */

export type Flat = {pts: Pt[]; cum: number[]; length: number};

const QUAD_STEPS = 18;

export const flatten = (cmds: Cmd[]): Flat => {
  const pts: Pt[] = [];
  let cursor: Pt = {x: 0, y: 0};
  for (const c of cmds) {
    if (c.t === 'M') {
      cursor = c.p;
      pts.push(cursor);
    } else if (c.t === 'L') {
      cursor = c.p;
      pts.push(cursor);
    } else {
      const p0 = cursor;
      for (let i = 1; i <= QUAD_STEPS; i++) {
        const t = i / QUAD_STEPS;
        const mt = 1 - t;
        pts.push({
          x: mt * mt * p0.x + 2 * mt * t * c.c.x + t * t * c.p.x,
          y: mt * mt * p0.y + 2 * mt * t * c.c.y + t * t * c.p.y,
        });
      }
      cursor = c.p;
    }
  }
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return {pts, cum, length: cum[cum.length - 1] ?? 0};
};

/** Point at a normalised distance along a flattened path. */
export const pointAt = (flat: Flat, t: number): Pt => {
  const target = Math.max(0, Math.min(1, t)) * flat.length;
  let lo = 0;
  let hi = flat.cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (flat.cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = flat.cum[hi] - flat.cum[lo] || 1;
  const k = (target - flat.cum[lo]) / span;
  return {
    x: flat.pts[lo].x + (flat.pts[hi].x - flat.pts[lo].x) * k,
    y: flat.pts[lo].y + (flat.pts[hi].y - flat.pts[lo].y) * k,
  };
};

/** Arrowhead triangle, built in plane space then transformed with the plane. */
export const arrowHead = (waypoints: Pt[], origin: Pt, size: number, m: Mat = PLANE): string => {
  const tip = waypoints[waypoints.length - 1];
  const prev = waypoints[waypoints.length - 2];
  const u = unit(prev, tip);
  const n = {x: -u.y, y: u.x};
  const back = {x: tip.x - u.x * size, y: tip.y - u.y * size};
  const half = size * 0.46;
  const pts = [
    tip,
    {x: back.x + n.x * half, y: back.y + n.y * half},
    {x: back.x - n.x * half, y: back.y - n.y * half},
  ].map((p) => toScreen(p, origin, m));
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
};
