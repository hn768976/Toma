import { DRIFT_AMPLITUDE, DURATION_IN_FRAMES, HEIGHT, TILT, WIDTH } from "./constants";

export type Point = { x: number; y: number };

/** Canvas affine matrix in ctx.setTransform() order: [a, b, c, d, e, f]. */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Applies `m` first, then `n` — i.e. the matrix product n * m. */
export const multiply = (n: Matrix, m: Matrix): Matrix => [
  n[0] * m[0] + n[2] * m[1],
  n[1] * m[0] + n[3] * m[1],
  n[0] * m[2] + n[2] * m[3],
  n[1] * m[2] + n[3] * m[3],
  n[0] * m[4] + n[2] * m[5] + n[4],
  n[1] * m[4] + n[3] * m[5] + n[5],
];

export const translation = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export const scaling = (sx: number, sy: number): Matrix => [sx, 0, 0, sy, 0, 0];

export const rotation = (deg: number): Matrix => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
};

/** Shear that tips the right-hand side of the plane upward. */
export const skewY = (deg: number): Matrix => [1, Math.tan((deg * Math.PI) / 180), 0, 1, 0, 0];

export const applyMatrix = (m: Matrix, p: Point): Point => ({
  x: m[0] * p.x + m[2] * p.y + m[4],
  y: m[1] * p.x + m[3] * p.y + m[5],
});

/**
 * The one tilted plane every element sits on. Built around the frame
 * centre so nothing drifts off-screen, then offset by the ambient drift
 * and scaled into whichever depth buffer is being drawn into.
 */
export const planeMatrix = (drift: Point, bufferScale: number): Matrix => {
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  let m = translation(cx + drift.x, cy + drift.y);
  m = multiply(m, rotation(TILT.rotationDeg));
  m = multiply(m, skewY(TILT.skewYDeg));
  m = multiply(m, scaling(1, TILT.compressY));
  m = multiply(m, translation(-cx, -cy));
  return multiply(scaling(bufferScale, bufferScale), m);
};

/**
 * Ambient drift: a closed figure-of-eight that returns to its start
 * exactly on frame 330, so the loop is seamless.
 */
export const driftAt = (frame: number): Point => {
  const t = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
  return {
    x: DRIFT_AMPLITUDE * Math.sin(2 * Math.PI * t),
    y: DRIFT_AMPLITUDE * 0.72 * Math.sin(4 * Math.PI * t + Math.PI / 3),
  };
};

export const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

export const lerpPoint = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
