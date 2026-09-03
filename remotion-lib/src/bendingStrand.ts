import { clamp } from "./colour";

/**
 * A single continuous curve that runs along one plane, bends through a
 * configurable angle over a smooth arc, and continues along another plane.
 *
 * Subject-agnostic: it knows nothing about what the curve represents. It is
 * described in a perspective frame — a vanishing point, a plane whose depth
 * maps linearly onto screen y, and lanes whose lateral offset grows with the
 * square of the distance from the horizon.
 *
 * The turn is a true circular fillet between the two tangents, approximated
 * by the cubic bezier that matches a circular arc, so it is always a smooth
 * arc and never a corner. Seeding the radius per curve and decorrelating it
 * from the bend depth is what stops a field of these forming a hard seam
 * where the curves reach the second plane.
 *
 * Nothing here is animated and nothing is random: give it the same options
 * and it returns the same points.
 *
 * @example
 *   const path = bendingStrandPath({
 *     vpx: 1920, vpy: 864, nearEdgeY: 2160, exitY: -302,
 *     lane: 0.5, spread: 4032, radius: 500, bendDepth: 0.55, direction: 1,
 *     samplesRun: 56, samplesArc: 30, samplesExit: 26,
 *   });
 */
export type BendingStrandOptions = {
  /** Vanishing point. */
  vpx: number;
  vpy: number;
  /**
   * Screen y of the first plane's near edge. Whether this is above or below
   * `vpy` is what makes the curve run along a floor or along a ceiling; the
   * sign is never assumed anywhere below.
   */
  nearEdgeY: number;
  /** Screen y the curve leaves through after the bend. */
  exitY: number;
  /** Lateral lane, typically -1..1. */
  lane: number;
  /** Lateral offset of lane 1 at the near edge, in px. */
  spread: number;
  /** Bend radius in px. Larger radii sweep further before straightening. */
  radius: number;
  /** Depth at which the bend starts: 0 at the horizon, 1 at the near edge. */
  bendDepth: number;
  /**
   * Signed turn direction. +1 turns toward smaller y after the bend, -1
   * toward larger y. Everything downstream inverts with it.
   */
  direction: 1 | -1;
  /** Depth the arc ends at, as a fraction of `bendDepth`. Default 0.55. */
  arcDepthRatio?: number;
  samplesRun?: number;
  samplesArc?: number;
  samplesExit?: number;
  /**
   * How much the second plane's section dims toward the exit edge, 0..1.
   * Default 0.18.
   */
  exitFalloff?: number;
};

export type PathPoint = {
  x: number;
  y: number;
  /** Depth: 0 at the horizon, 1 at the near edge. */
  d: number;
  /** Brightness multiplier independent of depth, 0..1. */
  bMul: number;
};

export type BendingStrandPath = {
  points: PathPoint[];
  /** Index range of the arc, inclusive of its first and last sample. */
  bendRange: [number, number];
  /** The point at which the curve finishes turning. */
  bendEnd: { x: number; y: number };
};

const bezier = (p0: number, c1: number, c2: number, p3: number, t: number) => {
  const s = 1 - t;
  return (
    s * s * s * p0 + 3 * s * s * t * c1 + 3 * s * t * t * c2 + t * t * t * p3
  );
};

export const bendingStrandPath = (
  o: BendingStrandOptions,
): BendingStrandPath => {
  const {
    vpx,
    vpy,
    nearEdgeY,
    exitY,
    lane,
    spread,
    radius,
    bendDepth,
    direction,
    arcDepthRatio = 0.55,
    samplesRun = 56,
    samplesArc = 30,
    samplesExit = 26,
    exitFalloff = 0.18,
  } = o;

  const planeY = (d: number) => vpy + (nearEdgeY - vpy) * d;
  // Lanes spread with d², not linearly: a linear spread reads as a flat fan
  // rather than a plane receding away from the camera.
  const laneX = (d: number) => vpx + lane * spread * d * d;

  const ax = laneX(bendDepth);
  const ay = planeY(bendDepth);

  // Screen-space tangent of the plane run at the bend, pointing horizonward.
  let tx = -lane * spread * 2 * bendDepth;
  let ty = -(nearEdgeY - vpy);
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl;
  ty /= tl;

  // The direction the curve leaves the bend in.
  const ex = 0;
  const ey = -direction;

  // Circular fillet between the two tangents.
  const phi = Math.acos(clamp(tx * ex + ty * ey, -1, 1));
  const L = radius * Math.tan(phi / 2);
  const bx = ax + tx * L + ex * L;
  const by = ay + ty * L + ey * L;
  // Control-point offset that makes a cubic bezier match a circular arc.
  const h = phi > 1e-4 ? (4 / 3) * Math.tan(phi / 4) * radius : 0;

  const points: PathPoint[] = [];

  // 1. the run along the first plane, from its near edge to the bend
  for (let j = 0; j < samplesRun; j++) {
    const t = j / (samplesRun - 1);
    const d = 1 + (bendDepth - 1) * t;
    points.push({ x: laneX(d), y: planeY(d), d, bMul: 1 });
  }

  // 2. the bend itself: a smooth arc, never a corner
  const dArcEnd = bendDepth * arcDepthRatio;
  for (let j = 1; j <= samplesArc; j++) {
    const t = j / samplesArc;
    points.push({
      x: bezier(ax, ax + tx * h, bx - ex * h, bx, t),
      y: bezier(ay, ay + ty * h, by - ey * h, by, t),
      d: bendDepth + (dArcEnd - bendDepth) * t,
      bMul: 1,
    });
  }

  // 3. the run along the second plane, out through the exit edge
  for (let j = 1; j <= samplesExit; j++) {
    const t = j / samplesExit;
    points.push({
      x: bx,
      y: by + (exitY - by) * t,
      d: dArcEnd,
      bMul: 1 - exitFalloff * t,
    });
  }

  return {
    points,
    bendRange: [samplesRun - 1, samplesRun - 1 + samplesArc],
    bendEnd: { x: bx, y: by },
  };
};

/**
 * Depth-derived half-width for a perspective curve: near samples are thick,
 * distant ones hairlines.
 */
export const depthWidth = (d: number, min: number, max: number, gamma = 1.7) =>
  0.5 * (min + (max - min) * Math.pow(d, gamma));

/**
 * Depth-derived brightness. It climbs with depth, then falls away again over
 * the nearest stretch by `nearFalloff`. Foreground curves in a dense field
 * are thick and usually defocused; at full brightness they overlap into one
 * saturated mass instead of reading as separate soft streaks. Pass 0 where
 * the nearest curves should stay bright.
 */
export const depthBrightness = (d: number, nearFalloff: number) => {
  const rise = 0.26 + 0.74 * Math.pow(d, 1.15);
  const t = clamp((d - 0.5) / 0.5, 0, 1);
  return rise * (1 - nearFalloff * t * t * (3 - 2 * t));
};
