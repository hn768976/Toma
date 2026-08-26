/**
 * 2x3 affine matrices, laid out exactly as `CanvasRenderingContext2D.setTransform`
 * takes them: [a, b, c, d, e, f] meaning
 *     x' = a*x + c*y + e
 *     y' = b*x + d*y + f
 *
 * Affine only — parallel lines stay parallel. That is deliberate: the plane is
 * a tilt, not a true perspective projection.
 */
export type Mat = readonly [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** Returns the matrix that applies `inner` first, then `outer`. */
export const mul = (outer: Mat, inner: Mat): Mat => [
  outer[0] * inner[0] + outer[2] * inner[1],
  outer[1] * inner[0] + outer[3] * inner[1],
  outer[0] * inner[2] + outer[2] * inner[3],
  outer[1] * inner[2] + outer[3] * inner[3],
  outer[0] * inner[4] + outer[2] * inner[5] + outer[4],
  outer[1] * inner[4] + outer[3] * inner[5] + outer[5],
];

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];

export const scale = (x: number, y: number): Mat => [x, 0, 0, y, 0, 0];

export const rotate = (rad: number): Mat => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
};

/** Horizontal shear: x' = x + k*y. */
export const shearX = (k: number): Mat => [1, 0, k, 1, 0, 0];

export const compose = (...mats: Mat[]): Mat => mats.reduce(mul, IDENTITY);

export type Pt = {x: number; y: number};

export const apply = (m: Mat, p: Pt): Pt => ({
  x: m[0] * p.x + m[2] * p.y + m[4],
  y: m[1] * p.x + m[3] * p.y + m[5],
});

export const invert = (m: Mat): Mat => {
  const det = m[0] * m[3] - m[1] * m[2];
  if (det === 0) {
    throw new Error('Plane matrix is singular and cannot be inverted');
  }
  const ia = m[3] / det;
  const ib = -m[1] / det;
  const ic = -m[2] / det;
  const id = m[0] / det;
  return [ia, ib, ic, id, -(ia * m[4] + ic * m[5]), -(ib * m[4] + id * m[5])];
};

/** Sets a context transform from a `Mat`, replacing whatever was there. */
export const setMat = (ctx: CanvasRenderingContext2D, m: Mat): void => {
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
};
