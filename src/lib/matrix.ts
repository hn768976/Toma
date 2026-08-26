/**
 * Minimal 2D affine matrix in canvas order: [a, b, c, d, e, f], where
 *   x' = a*x + c*y + e
 *   y' = b*x + d*y + f
 * Affine only — parallel lines stay parallel, which is exactly what the faked
 * perspective needs.
 */
export type Mat2D = readonly [number, number, number, number, number, number];

export const IDENTITY: Mat2D = [1, 0, 0, 1, 0, 0];

/** `multiply(A, B)` applies B first, then A. */
export const multiply = (A: Mat2D, B: Mat2D): Mat2D => [
  A[0] * B[0] + A[2] * B[1],
  A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3],
  A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4],
  A[1] * B[4] + A[3] * B[5] + A[5],
];

export const translation = (x: number, y: number): Mat2D => [1, 0, 0, 1, x, y];

export const scaling = (s: number): Mat2D => [s, 0, 0, s, 0, 0];

export const rotation = (radians: number): Mat2D => {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [c, s, -s, c, 0, 0];
};

/** Compresses x and shears it along y. `x' = compression*x + shear*y`. */
export const shearAndCompress = (compression: number, shear: number): Mat2D => [
  compression,
  0,
  shear,
  1,
  0,
  0,
];

export const applyToPoint = (m: Mat2D, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/** Inverse of an affine matrix. Throws on a degenerate (zero-determinant) basis. */
export const invert = (m: Mat2D): Mat2D => {
  const det = m[0] * m[3] - m[1] * m[2];
  if (det === 0) {
    throw new Error('Cannot invert a degenerate affine matrix');
  }
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
};

export const setTransform = (ctx: CanvasRenderingContext2D, m: Mat2D): void => {
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
};
