/**
 * A shared "hand-placed" tilt: a small rotation plus a vertical shear so
 * the right-hand side of the group sits marginally higher than a pure
 * rotation would put it.
 *
 * Two forms of the same transform are exported so canvas drawing and
 * plain point maths agree: `applyTilt` pushes it onto a context, and
 * `tiltPoint` maps a local point into frame space (needed by layers that
 * are not themselves tilted, e.g. working out where the bar's leading
 * edge lands so dust can brighten around it).
 */
export type Tilt = { degrees: number; shear: number };

export const DEFAULT_TILT: Tilt = { degrees: -4, shear: -0.03 };

/** Push the tilt onto `ctx`. Caller is responsible for save()/restore(). */
export const applyTilt = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tilt: Tilt = DEFAULT_TILT,
): void => {
  const cx = width / 2;
  const cy = height / 2;
  ctx.translate(cx, cy);
  ctx.rotate((tilt.degrees * Math.PI) / 180);
  ctx.transform(1, tilt.shear, 0, 1, 0, 0);
  ctx.translate(-cx, -cy);
};

/**
 * Map a *displacement* in frame space back into untilted space, so a
 * layout can say "move the group 138px up on screen" and get the
 * offset to add to its untilted coordinates. The tilt is affine about
 * the frame centre, so only its linear part matters here — inverting
 * the rotation and then the shear.
 */
export const untiltVector = (
  dx: number,
  dy: number,
  tilt: Tilt = DEFAULT_TILT,
): { x: number; y: number } => {
  const rad = (-tilt.degrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const rx = dx * c - dy * s;
  const ry = dx * s + dy * c;
  return { x: rx, y: ry - tilt.shear * rx };
};

/** Map an untilted point into the tilted frame. Mirrors `applyTilt`. */
export const tiltPoint = (
  x: number,
  y: number,
  width: number,
  height: number,
  tilt: Tilt = DEFAULT_TILT,
): { x: number; y: number } => {
  const cx = width / 2;
  const cy = height / 2;
  const px = x - cx;
  const shearedY = tilt.shear * px + (y - cy);
  const rad = (tilt.degrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x: px * c - shearedY * s + cx,
    y: px * s + shearedY * c + cy,
  };
};
