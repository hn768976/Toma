import type { Ctx } from "./canvas";
import { clamp, rgba, type Rgb } from "./colour";
import { radialBlob } from "./radialBlob";

/**
 * A point of light that follows a precomputed curve at parameter t, with a
 * comet trail behind it.
 *
 * Subject-agnostic. The point is always ON the curve — it is the curve
 * evaluated at t, never a free path — so it cannot drift off whatever it is
 * travelling along. The trail is sampled at t, t-step, t-2*step ... and drawn
 * through the curve's OWN points between those parameters, so it bends with
 * the curve instead of cutting the corner.
 *
 * Sampling a precomputed polyline rather than evaluating a bezier makes
 * placement a lookup, which matters when hundreds of these are drawn per
 * frame.
 *
 * @example
 *   drawTravellingPacket(ctx, {
 *     positions, count, u: 0.42, trailSign: -1,
 *     radius: 9, alpha: 0.9,
 *     inner: white, outer: cyan, trail: dimCyan,
 *   });
 */
export type PolylineSample = { x: number; y: number; i0: number; i1: number };

/** Interpolate a flat [x0,y0,x1,y1,...] polyline at parameter u in 0..1. */
export const samplePolyline = (
  positions: Float64Array,
  count: number,
  u: number,
): PolylineSample => {
  const last = count - 1;
  const fi = clamp(u, 0, 1) * last;
  const i0 = Math.floor(fi);
  const i1 = Math.min(last, i0 + 1);
  const t = fi - i0;
  return {
    x: positions[i0 * 2] + (positions[i1 * 2] - positions[i0 * 2]) * t,
    y: positions[i0 * 2 + 1] + (positions[i1 * 2 + 1] - positions[i0 * 2 + 1]) * t,
    i0,
    i1,
  };
};

export type TravellingPacketOptions = {
  positions: Float64Array;
  count: number;
  /** Curve parameter of the packet's head, 0..1. */
  u: number;
  /** Which way the trail lags: -1 when u is increasing, +1 when decreasing. */
  trailSign: 1 | -1;
  /** Trail tap spacing in curve parameter. Default 0.015. */
  trailStep?: number;
  /** Number of trail segments. Default 3. */
  trailTaps?: number;
  /** Head radius in px. */
  radius: number;
  alpha: number;
  /** Hot centre of the head. */
  inner: Rgb;
  /** Body of the head and its halo. */
  outer: Rgb;
  /** Trail colour. */
  trail: Rgb;
  /**
   * Smear the head along a motion vector, at decreasing alpha. Use where a
   * packet moves far enough between frames to strobe otherwise.
   */
  smear?: { dx: number; dy: number; copies: number };
};

export const drawTravellingPacket = (ctx: Ctx, o: TravellingPacketOptions) => {
  const {
    positions,
    count,
    u,
    trailSign,
    trailStep = 0.015,
    trailTaps = 3,
    radius,
    alpha,
    inner,
    outer,
    trail,
    smear,
  } = o;

  const at = (uu: number) => samplePolyline(positions, count, uu);
  const head = at(u);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let tap = 0; tap < trailTaps; tap++) {
    const uA = u + trailSign * trailStep * tap;
    const uB = u + trailSign * trailStep * (tap + 1);
    if (Math.max(uA, uB) < 0 || Math.min(uA, uB) > 1) continue;
    const pA = at(uA);
    const pB = at(uB);
    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    // Walk the curve's own samples between the two taps.
    const iLo = Math.min(pA.i1, pB.i1);
    const iHi = Math.max(pA.i0, pB.i0);
    for (let i = iLo; i <= iHi; i++) {
      ctx.lineTo(positions[i * 2], positions[i * 2 + 1]);
    }
    ctx.lineTo(pB.x, pB.y);
    const fade = 1 - tap / trailTaps;
    ctx.strokeStyle = rgba(trail, alpha * 0.5 * fade * fade);
    ctx.lineWidth = radius * (0.85 - 0.18 * tap);
    ctx.stroke();
  }

  if (smear && Math.hypot(smear.dx, smear.dy) > radius * 0.9) {
    for (let m = 1; m <= smear.copies; m++) {
      const t = m / (smear.copies + 1);
      radialBlob(
        ctx,
        head.x - smear.dx * t,
        head.y - smear.dy * t,
        radius * (1 - 0.25 * t),
        outer,
        outer,
        alpha * 0.3 * (1 - t),
        0.4,
      );
    }
  }

  radialBlob(ctx, head.x, head.y, radius * 3.6, outer, outer, alpha * 0.16, 0.3);
  radialBlob(ctx, head.x, head.y, radius * 1.5, inner, outer, alpha * 0.55, 0.35);
  radialBlob(ctx, head.x, head.y, radius * 0.6, inner, inner, alpha * 0.95, 0.5);
};
