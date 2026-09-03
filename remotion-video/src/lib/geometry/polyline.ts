/**
 * Pure 2D geometry used by the layout engine and the connector renderer.
 *
 * Paths are represented as plain polylines so that a straight connector and a
 * sampled curve are the same kind of thing downstream: <ConnectorLines> can
 * stroke either, and a travelling dot can be positioned by arc length along
 * either, without knowing which layout mode produced it.
 */

export type Vec2 = { x: number; y: number };

export type Arc = {
  cx: number;
  cy: number;
  r: number;
  /** Start and end angle in radians. */
  from: number;
  to: number;
};

/** Cumulative arc length at each vertex; index 0 is always 0. */
export const cumulativeLengths = (points: readonly Vec2[]): number[] => {
  const out = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    out.push(out[i - 1] + Math.hypot(dx, dy));
  }
  return out;
};

export const polylineLength = (points: readonly Vec2[]): number => {
  const cum = cumulativeLengths(points);
  return cum[cum.length - 1];
};

/**
 * Point at normalised arc length `t` (0..1) along a polyline — uniform speed,
 * which is what keeps travelling dots from lurching on a sampled curve.
 */
export const pointAtT = (
  points: readonly Vec2[],
  cum: readonly number[],
  t: number,
): Vec2 => {
  const total = cum[cum.length - 1];
  if (total <= 0 || points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const target = Math.max(0, Math.min(1, t)) * total;
  // Linear scan: polylines here are short (<= ~200 points) and this runs a
  // handful of times per frame.
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const span = cum[i] - cum[i - 1] || 1;
  const local = (target - cum[i - 1]) / span;
  return {
    x: points[i - 1].x + (points[i].x - points[i - 1].x) * local,
    y: points[i - 1].y + (points[i].y - points[i - 1].y) * local,
  };
};

/** Samples an arc into a polyline. */
export const sampleArc = (arc: Arc, steps: number): Vec2[] => {
  const out: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = arc.from + (arc.to - arc.from) * (i / steps);
    out.push({
      x: arc.cx + Math.cos(a) * arc.r,
      y: arc.cy + Math.sin(a) * arc.r,
    });
  }
  return out;
};

/** Point on an arc at normalised angular position `t`. */
export const arcPoint = (arc: Arc, t: number): Vec2 => {
  const a = arc.from + (arc.to - arc.from) * t;
  return { x: arc.cx + Math.cos(a) * arc.r, y: arc.cy + Math.sin(a) * arc.r };
};

/**
 * Builds an arc of radius `r` that passes exactly through `through`, with its
 * tangent there pointing along `tangent` (radians). `side` picks which of the
 * two possible centres to use. This is how the hub is made to sit *on* two
 * arcs rather than at the centre of a radial burst.
 */
export const arcThroughPoint = (
  through: Vec2,
  r: number,
  tangent: number,
  span: number,
  side: 1 | -1,
): Arc => {
  // Centre lies on the normal to the tangent, r away from the point.
  const nx = -Math.sin(tangent) * side;
  const ny = Math.cos(tangent) * side;
  const cx = through.x + nx * r;
  const cy = through.y + ny * r;
  const at = Math.atan2(through.y - cy, through.x - cx);
  return { cx, cy, r, from: at - span / 2, to: at + span / 2 };
};

/** Shortest distance from `p` to segment `a`-`b`. */
export const distToSegment = (p: Vec2, a: Vec2, b: Vec2): number => {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
};

/** Shortest distance from `p` to a polyline. */
export const distToPolyline = (p: Vec2, points: readonly Vec2[]): number => {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    best = Math.min(best, distToSegment(p, points[i - 1], points[i]));
  }
  return best;
};

/**
 * Distance from `origin` to the frame edge along `angle`, inset by `margin`.
 * Used to spread radiating satellites all the way out to the frame edges
 * without letting any of them fall off it.
 */
export const distanceToFrameEdge = (
  origin: Vec2,
  angle: number,
  width: number,
  height: number,
  margin: number,
): number => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const limits: number[] = [];
  if (Math.abs(c) > 1e-6) {
    limits.push(((c > 0 ? width - margin : margin) - origin.x) / c);
  }
  if (Math.abs(s) > 1e-6) {
    limits.push(((s > 0 ? height - margin : margin) - origin.y) / s);
  }
  const positive = limits.filter((v) => v > 0);
  return positive.length ? Math.min(...positive) : 0;
};

export type Rect = { x: number; y: number; w: number; h: number };

/** True if a circle of `radius` at `p` overlaps `rect`, grown by `pad`. */
export const circleHitsRect = (
  p: Vec2,
  radius: number,
  rect: Rect,
  pad = 0,
): boolean => {
  const left = rect.x - pad;
  const top = rect.y - pad;
  const right = rect.x + rect.w + pad;
  const bottom = rect.y + rect.h + pad;
  const nearestX = Math.max(left, Math.min(p.x, right));
  const nearestY = Math.max(top, Math.min(p.y, bottom));
  return Math.hypot(p.x - nearestX, p.y - nearestY) < radius;
};

/**
 * The span of normalised arc length over which a polyline stays inside a
 * `margin` inset of a `width` x `height` frame.
 *
 * Rails are sampled far beyond the frame so they read as segments of very
 * large circles, which means a naive stratification over the whole rail puts
 * some slots off-screen. Stratifying over this span instead keeps every slot
 * on a visible stretch. Returns null when the polyline never enters the inset
 * region. The span is the outermost in-frame extent, so a rail that leaves and
 * re-enters can still yield an off-frame t in between — callers are expected
 * to bounds-check the point they finally place.
 */
export const inFrameSpan = (
  points: readonly Vec2[],
  cum: readonly number[],
  width: number,
  height: number,
  margin: number,
): { from: number; to: number } | null => {
  const total = cum[cum.length - 1];
  if (total <= 0) return null;

  let first = -1;
  let last = -1;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const inside =
      p.x >= margin &&
      p.x <= width - margin &&
      p.y >= margin &&
      p.y <= height - margin;
    if (!inside) continue;
    if (first < 0) first = i;
    last = i;
  }
  if (first < 0 || first === last) return null;

  return { from: cum[first] / total, to: cum[last] / total };
};
