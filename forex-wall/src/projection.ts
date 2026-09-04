/**
 * Analytic mirror of the CSS perspective projection used by the wall.
 *
 * The board is one `perspective` container holding one `preserve-3d` plane
 * rotated by rotateX(ROT_X) rotateY(ROT_Y). The browser does the actual
 * drawing; these functions reproduce the same maths in JS so we can decide,
 * per quote block, how big it will end up on screen — which is what the
 * depth-of-field slices, the brightness falloff and the culling need.
 *
 * For a point (x, y, 0) in plane space, CSS applies Rx(a) * Ry(t) and then
 * divides by (1 - Z / PERSPECTIVE); positions are relative to the
 * perspective origin, which we also use as the plane's transform origin, so
 * plane (0, 0) and the perspective origin are the same point.
 */

import {
  ORIGIN_X,
  ORIGIN_Y,
  PERSPECTIVE,
  REF_HEIGHT,
  REF_WIDTH,
  ROT_X_DEG,
  ROT_Y_DEG,
} from "./constants";

const RAD = Math.PI / 180;
const SIN_T = Math.sin(ROT_Y_DEG * RAD);
const COS_T = Math.cos(ROT_Y_DEG * RAD);
const SIN_A = Math.sin(ROT_X_DEG * RAD);
const COS_A = Math.cos(ROT_X_DEG * RAD);

export type Projected = {
  /** Screen x, in reference px, measured from the top-left of the frame. */
  x: number;
  /** Screen y, in reference px, measured from the top-left of the frame. */
  y: number;
  /** Perspective scale. 1 = the plane's own scale, >1 = nearer than the origin. */
  s: number;
};

export const project = (x: number, y: number): Projected => {
  const X = x * COS_T;
  const Y = y * COS_A + x * SIN_T * SIN_A;
  const Z = y * SIN_A - x * SIN_T * COS_A;
  // Points at or behind the eye have no meaningful projection; clamp so the
  // caller sees an absurd scale and culls them instead of getting NaN.
  const denom = PERSPECTIVE - Z;
  const s = denom <= 1 ? Infinity : PERSPECTIVE / denom;
  return {
    x: ORIGIN_X * REF_WIDTH + X * s,
    y: ORIGIN_Y * REF_HEIGHT + Y * s,
    s,
  };
};

/** Perspective scale alone — the hot path, called for every candidate block. */
export const scaleAt = (x: number, y: number): number => {
  const Z = y * SIN_A - x * SIN_T * COS_A;
  const denom = PERSPECTIVE - Z;
  return denom <= 1 ? Infinity : PERSPECTIVE / denom;
};

/**
 * Screen bounding box of an axis-aligned rectangle on the plane. A plane
 * under perspective maps straight lines to straight lines, so the four
 * corners bound the whole rectangle.
 */
export const projectRectBounds = (
  x: number,
  y: number,
  w: number,
  h: number,
): { left: number; top: number; right: number; bottom: number } => {
  const a = project(x, y);
  const b = project(x + w, y);
  const c = project(x, y + h);
  const d = project(x + w, y + h);
  return {
    left: Math.min(a.x, b.x, c.x, d.x),
    top: Math.min(a.y, b.y, c.y, d.y),
    right: Math.max(a.x, b.x, c.x, d.x),
    bottom: Math.max(a.y, b.y, c.y, d.y),
  };
};

/** True when the plane rectangle lands anywhere inside the frame + margin. */
export const isOnScreen = (
  x: number,
  y: number,
  w: number,
  h: number,
  margin = 40,
): boolean => {
  const b = projectRectBounds(x, y, w, h);
  if (!Number.isFinite(b.left) || !Number.isFinite(b.right)) return false;
  return (
    b.right > -margin &&
    b.left < REF_WIDTH + margin &&
    b.bottom > -margin &&
    b.top < REF_HEIGHT + margin
  );
};
