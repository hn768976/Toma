/**
 * Shape primitives for <BandLayer>.
 *
 * Every band — whatever its type — is drawn against a single abstraction: a
 * closed, arc-length-parameterised polyline ("Outline") defined at unit size.
 * Swapping the geometry mode swaps ONLY the function that produces that
 * polyline. Nothing downstream (dashes, thickness, arc ranges, ticks, bars,
 * edge dots) knows or cares which primitive it is walking.
 */

export type GeometryMode = 'rings' | 'bubbles';

export interface OutlinePoint {
  x: number;
  y: number;
  /** Outward unit normal, used to erect ticks and bars off the path. */
  nx: number;
  ny: number;
}

export interface Outline {
  pts: OutlinePoint[];
  /** Cumulative arc length at each point; cum[0] === 0. */
  cum: number[];
  total: number;
}

const buildOutline = (raw: Array<{x: number; y: number}>): Outline => {
  const n = raw.length;

  let cxSum = 0;
  let cySum = 0;
  for (const p of raw) {
    cxSum += p.x;
    cySum += p.y;
  }
  const cx = cxSum / n;
  const cy = cySum / n;

  const pts: OutlinePoint[] = [];
  for (let i = 0; i < n; i++) {
    const prev = raw[(i - 1 + n) % n];
    const next = raw[(i + 1) % n];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tl = Math.hypot(tx, ty) || 1;
    // Perpendicular to the tangent, flipped outward relative to the centroid.
    let nx = -ty / tl;
    let ny = tx / tl;
    if (nx * (raw[i].x - cx) + ny * (raw[i].y - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    pts.push({x: raw[i].x, y: raw[i].y, nx, ny});
  }

  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i <= n; i++) {
    const a = pts[i - 1];
    const b = pts[i % n];
    total += Math.hypot(b.x - a.x, b.y - a.y);
    cum.push(total);
  }

  return {pts, cum, total};
};

/** Unit circle, radius 1, starting at angle 0 (screen right) and going clockwise. */
const buildCircle = (segments: number): Outline => {
  const raw: Array<{x: number; y: number}> = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    raw.push({x: Math.cos(a), y: Math.sin(a)});
  }
  return buildOutline(raw);
};

/**
 * Unit speech bubble: a rounded rectangle with a triangular tail on the lower
 * left. Its vertical extent is pre-centred on the origin so that scaling the
 * whole shape by `r` produces genuinely concentric bubbles.
 */
const buildBubble = (): Outline => {
  const W = 1.15; // half width
  const H = 0.72; // half height of the body
  const C = 0.34; // corner radius
  const TAIL_RIGHT = -0.2; // where the tail leaves the bottom edge (rightmost)
  const TAIL_LEFT = -0.62; // where it rejoins (leftmost)
  const TIP_X = -0.94;
  const TIP_Y = H + 0.46;
  const Y_SHIFT = -0.14; // offset the tail overhang without floating the body

  const raw: Array<{x: number; y: number}> = [];
  const line = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    steps: number
  ) => {
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      raw.push({x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t});
    }
  };
  const arc = (
    ox: number,
    oy: number,
    a0: number,
    a1: number,
    steps: number
  ) => {
    for (let i = 0; i < steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      raw.push({x: ox + Math.cos(a) * C, y: oy + Math.sin(a) * C});
    }
  };

  // Clockwise in screen coordinates (y grows downward).
  line(-W + C, -H, W - C, -H, 90); // top edge
  arc(W - C, -H + C, -Math.PI / 2, 0, 40); // top-right corner
  line(W, -H + C, W, H - C, 70); // right edge
  arc(W - C, H - C, 0, Math.PI / 2, 40); // bottom-right corner
  line(W - C, H, TAIL_RIGHT, H, 60); // bottom edge, right of the tail
  line(TAIL_RIGHT, H, TIP_X, TIP_Y, 34); // tail, outbound
  line(TIP_X, TIP_Y, TAIL_LEFT, H, 34); // tail, inbound
  line(TAIL_LEFT, H, -W + C, H, 26); // bottom edge, left of the tail
  arc(-W + C, H - C, Math.PI / 2, Math.PI, 40); // bottom-left corner
  line(-W, H - C, -W, -H + C, 70); // left edge
  arc(-W + C, -H + C, Math.PI, Math.PI * 1.5, 40); // top-left corner

  return buildOutline(raw.map((p) => ({x: p.x, y: p.y + Y_SHIFT})));
};

const CACHE = new Map<GeometryMode, Outline>();

export const getUnitOutline = (mode: GeometryMode): Outline => {
  const hit = CACHE.get(mode);
  if (hit) return hit;
  const built = mode === 'bubbles' ? buildBubble() : buildCircle(720);
  CACHE.set(mode, built);
  return built;
};

/** Point at normalised arc-length position `t` (wraps outside [0,1)). */
export const pointAt = (o: Outline, t: number): OutlinePoint => {
  const target = ((t % 1) + 1) % 1 * o.total;
  let lo = 0;
  let hi = o.cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (o.cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const n = o.pts.length;
  const a = o.pts[lo % n];
  const b = o.pts[(lo + 1) % n];
  const span = o.cum[lo + 1] - o.cum[lo] || 1;
  const f = (target - o.cum[lo]) / span;
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    nx: a.nx + (b.nx - a.nx) * f,
    ny: a.ny + (b.ny - a.ny) * f,
  };
};

/** Lay down the complete closed path at radius `r`. */
export const tracePath = (
  ctx: CanvasRenderingContext2D,
  o: Outline,
  r: number
): void => {
  ctx.beginPath();
  for (let i = 0; i < o.pts.length; i++) {
    const p = o.pts[i];
    if (i === 0) ctx.moveTo(p.x * r, p.y * r);
    else ctx.lineTo(p.x * r, p.y * r);
  }
  ctx.closePath();
};

/** Lay down an open sub-range of the path, by normalised arc length. */
export const tracePathRange = (
  ctx: CanvasRenderingContext2D,
  o: Outline,
  r: number,
  t0: number,
  t1: number
): void => {
  const steps = Math.max(8, Math.round(Math.abs(t1 - t0) * o.pts.length));
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const p = pointAt(o, t0 + (t1 - t0) * (i / steps));
    if (i === 0) ctx.moveTo(p.x * r, p.y * r);
    else ctx.lineTo(p.x * r, p.y * r);
  }
};
