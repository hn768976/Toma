/**
 * Geometry for the heraldic shield: flat across the top with slightly rounded
 * corners, sides curving down and inward to a rounded point at the bottom.
 *
 * The outline is sampled into a polyline with a cumulative arc-length table so
 * that both the travelling brightness sweep (v1) and the disconnected arc
 * segments (v2) can address the boundary by fraction-of-perimeter rather than
 * by curve parameter.
 */

export type Outline = {
  xs: Float64Array;
  ys: Float64Array;
  /** Cumulative arc length, cum[0] === 0, cum[n-1] === total. */
  cum: Float64Array;
  total: number;
  n: number;
  /** Local-space half extents, for clipping and texture bounds. */
  halfW: number;
  halfH: number;
};

type Cubic = readonly [number, number, number, number, number, number, number, number];

// Normalised shield, centred on (0, 0). Height spans -0.58 .. 0.62.
const W = 0.5;
const TOP = -0.58;
const TIP = 0.62;
const R = 0.11;
const K = 0.5523 * R;

const SEGMENTS: Cubic[] = [
  // top edge
  [-W + R, TOP, -W + R * 2, TOP, W - R * 2, TOP, W - R, TOP],
  // top-right corner
  [W - R, TOP, W - R + K, TOP, W, TOP + R - K, W, TOP + R],
  // right flank, curving down and inward
  [W, TOP + R, W, 0.13, 0.45, 0.335, 0.115, 0.545],
  // rounded point, right half
  [0.115, 0.545, 0.078, 0.583, 0.038, TIP, 0, TIP],
  // rounded point, left half
  [0, TIP, -0.038, TIP, -0.078, 0.583, -0.115, 0.545],
  // left flank
  [-0.115, 0.545, -0.45, 0.335, -W, 0.13, -W, TOP + R],
  // top-left corner
  [-W, TOP + R, -W, TOP + R - K, -W + R - K, TOP, -W + R, TOP],
];

const cubicAt = (s: Cubic, t: number, out: { x: number; y: number }) => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  out.x = a * s[0] + b * s[2] + c * s[4] + d * s[6];
  out.y = a * s[1] + b * s[3] + c * s[5] + d * s[7];
};

const PER_SEGMENT = 170;

/** Builds the closed outline already scaled to local plane pixels. */
export const buildShieldOutline = (scale: number): Outline => {
  const n = SEGMENTS.length * PER_SEGMENT + 1;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const cum = new Float64Array(n);
  const p = { x: 0, y: 0 };
  let i = 0;
  for (let s = 0; s < SEGMENTS.length; s++) {
    const seg = SEGMENTS[s];
    for (let k = 0; k < PER_SEGMENT; k++) {
      cubicAt(seg, k / PER_SEGMENT, p);
      xs[i] = p.x * scale;
      ys[i] = p.y * scale;
      i++;
    }
  }
  // close the loop back onto the first point
  xs[i] = xs[0];
  ys[i] = ys[0];

  let total = 0;
  for (let k = 1; k < n; k++) {
    total += Math.hypot(xs[k] - xs[k - 1], ys[k] - ys[k - 1]);
    cum[k] = total;
  }

  return {
    xs,
    ys,
    cum,
    total,
    n,
    halfW: W * scale,
    halfH: ((TIP - TOP) / 2) * scale,
  };
};

/** Index of the sample at arc-length `len`, via binary search. */
const indexAt = (o: Outline, len: number) => {
  let lo = 0;
  let hi = o.n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (o.cum[mid] < len) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/** Traces the whole closed outline into the current path. */
export const pathFull = (ctx: CanvasRenderingContext2D, o: Outline) => {
  ctx.beginPath();
  ctx.moveTo(o.xs[0], o.ys[0]);
  for (let i = 1; i < o.n; i++) ctx.lineTo(o.xs[i], o.ys[i]);
  ctx.closePath();
};

/**
 * Traces the arc between two fractions of the perimeter. Fractions wrap, so
 * `t0 = 0.9, t1 = 1.1` walks across the seam without a visible join.
 */
export const pathRange = (ctx: CanvasRenderingContext2D, o: Outline, t0: number, t1: number) => {
  const span = t1 - t0;
  if (span <= 0) return;
  const startLen = ((t0 % 1) + 1) % 1 * o.total;
  const steps = Math.max(3, Math.round(span * 420));
  ctx.beginPath();
  for (let s = 0; s <= steps; s++) {
    let len = startLen + (span * o.total * s) / steps;
    len %= o.total;
    const i = indexAt(o, len);
    if (s === 0) ctx.moveTo(o.xs[i], o.ys[i]);
    else ctx.lineTo(o.xs[i], o.ys[i]);
  }
};

/* ------------------------------------------------------------------ *
 * The exclamation mark
 * ------------------------------------------------------------------ */

/** Rounded vertical bar, centred on (0, 0) of the shield's local space. */
export const pathExclamationBar = (
  ctx: CanvasRenderingContext2D,
  scale: number,
) => {
  const w = 0.088 * scale;
  const top = -0.29 * scale;
  const bottom = 0.11 * scale;
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(-r, top + r);
  ctx.arc(0, top + r, r, Math.PI, 0);
  ctx.lineTo(r, bottom - r);
  ctx.arc(0, bottom - r, r, 0, Math.PI);
  ctx.closePath();
};

/** Rounded dot below the bar. */
export const pathExclamationDot = (
  ctx: CanvasRenderingContext2D,
  scale: number,
) => {
  ctx.beginPath();
  ctx.arc(0, 0.245 * scale, 0.052 * scale, 0, Math.PI * 2);
  ctx.closePath();
};
