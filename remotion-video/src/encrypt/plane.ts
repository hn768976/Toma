/**
 * The tilted plane.
 *
 * Everything in the piece sits on ONE plane receding to the upper right,
 * reached through a single affine transform: a small rotation plus a shear
 * that compresses the right-hand side. It is deliberately NOT a perspective
 * projection — parallel lines stay parallel, which at this blur level is
 * indistinguishable from the real thing and far cheaper.
 */

export type Matrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

const ROTATION_DEG = -9;
/** Vertical shear: the right-hand side rides up as it recedes. */
const SHEAR = -0.045;
/** Horizontal compression of the receding side, ~7%. */
const COMPRESS = 0.93;
/** Overscan so the rotated plane still covers the frame corners. */
const OVERSCAN = 1.16;

/**
 * Builds the plane -> screen matrix for a frame of `w` x `h`, pivoting about
 * the frame centre. `res` scales the whole thing for a reduced-resolution
 * depth-of-field buffer.
 */
export const planeMatrix = (w: number, h: number, res = 1): Matrix => {
  const th = (ROTATION_DEG * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const k = OVERSCAN;

  const a = (cos * COMPRESS - sin * SHEAR) * k;
  const b = (sin * COMPRESS + cos * SHEAR) * k;
  const c = -sin * k;
  const d = cos * k;

  const cx = w / 2;
  const cy = h / 2;
  const e = cx - (a * cx + c * cy);
  const f = cy - (b * cx + d * cy);

  return { a: a * res, b: b * res, c: c * res, d: d * res, e: e * res, f: f * res };
};

export const applyMatrix = (ctx: CanvasRenderingContext2D, m: Matrix): void => {
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
};

/** Maps a screen point back into plane coordinates. */
export const screenToPlane = (
  m: Matrix,
  x: number,
  y: number,
): { x: number; y: number } => {
  const det = m.a * m.d - m.b * m.c;
  const px = x - m.e;
  const py = y - m.f;
  return {
    x: (px * m.d - py * m.c) / det,
    y: (py * m.a - px * m.b) / det,
  };
};

/** Uniform-ish scale the matrix applies along the plane's x axis. */
export const planeScaleX = (m: Matrix): number => Math.hypot(m.a, m.b);

export type PlaneBounds = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
};

/**
 * The region of plane space that has to be drawn for the screen to be fully
 * covered, plus padding so the softest elements never reveal an edge.
 */
export const planeBounds = (
  m: Matrix,
  w: number,
  h: number,
  pad = 220,
): PlaneBounds => {
  const corners = [
    screenToPlane(m, 0, 0),
    screenToPlane(m, w, 0),
    screenToPlane(m, 0, h),
    screenToPlane(m, w, h),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  const x1 = Math.max(...xs) + pad;
  const y1 = Math.max(...ys) + pad;
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
};
