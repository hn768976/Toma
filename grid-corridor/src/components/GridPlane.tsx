import React from "react";
import { GRID_PITCH } from "../constants";
import { clipToPlane, setPlaneTransform, type Plane } from "../geometry";
import { bucketWeights } from "../geometry";
import { gridDrift } from "../layout";
import { LAYER, useRegister, type DrawOp } from "../scene";
import { withAlpha } from "../sprites";
import type { Bucket, Palette } from "../variants";

type Props = {
  plane: Plane;
  palette: Palette;
  buckets: Bucket[];
  glow: Bucket;
  frame: number;
  rollDirection: number;
};

/** How bright the grid is at a given depth. Distant grid fades into the wash. */
const gridBrightness = (d: number): number => {
  const rise = Math.min(1, d / 0.45);
  const fall = 1 - 0.45 * Math.max(0, (d - 0.72) / 0.28);
  return (0.16 + 0.84 * rise) * fall;
};

const GRADIENT_STOPS = 26;

/**
 * One tilted plane of the corridor: a regular grid of thin bright lines on its
 * own local axes. Parallel lines stay parallel inside the plane — the corners
 * of the space come from the seams between planes, not from projection.
 */
export const GridPlane: React.FC<Props> = ({
  plane,
  palette,
  buckets,
  glow,
  frame,
  rollDirection,
}) => {
  const drift = gridDrift(plane, frame, rollDirection);
  const { bbox } = plane;

  const tracePath = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    const u0 = Math.floor((bbox.u0 - drift.u) / GRID_PITCH) * GRID_PITCH + drift.u;
    for (let u = u0; u <= bbox.u1; u += GRID_PITCH) {
      ctx.moveTo(u, bbox.v0);
      ctx.lineTo(u, bbox.v1);
    }
    const v0 = Math.floor((bbox.v0 - drift.v) / GRID_PITCH) * GRID_PITCH + drift.v;
    for (let v = v0; v <= bbox.v1; v += GRID_PITCH) {
      ctx.moveTo(bbox.u0, v);
      ctx.lineTo(bbox.u1, v);
    }
  };

  /**
   * Depth radiates from the plane's vanishing anchor, so the gradient carries
   * both the depth-of-field weighting and the distance falloff in one stroke.
   */
  const makeGradient = (
    ctx: CanvasRenderingContext2D,
    weightFor: (d: number) => number,
  ): CanvasGradient => {
    const g = ctx.createRadialGradient(
      plane.vanish.x,
      plane.vanish.y,
      0,
      plane.vanish.x,
      plane.vanish.y,
      plane.depthRadius,
    );
    for (let i = 0; i <= GRADIENT_STOPS; i++) {
      const t = i / GRADIENT_STOPS;
      const colour = t < 0.45 ? palette.structureDim : palette.structureMain;
      g.addColorStop(t, withAlpha(colour, weightFor(t) * gridBrightness(t) * plane.tone));
    }
    return g;
  };

  const ops: DrawOp[] = buckets.map((bucket, index) => ({
    order: LAYER.grid,
    bucket: bucket.key,
    alpha: 1,
    fn: (ctx, res) => {
      ctx.setTransform(res, 0, 0, res, 0, 0);
      clipToPlane(ctx, plane);
      setPlaneTransform(ctx, res, plane.m);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = makeGradient(
        ctx,
        (d) => bucketWeights(d, buckets.length)[index],
      );
      tracePath(ctx);
      ctx.stroke();
    },
  }));

  // The grid is one of the two things that bloom.
  ops.push({
    order: LAYER.grid,
    bucket: glow.key,
    alpha: 0.42,
    fn: (ctx, res) => {
      ctx.setTransform(res, 0, 0, res, 0, 0);
      clipToPlane(ctx, plane);
      setPlaneTransform(ctx, res, plane.m);
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = makeGradient(ctx, (d) => Math.min(1, 0.35 + d * 0.65));
      tracePath(ctx);
      ctx.stroke();
    },
  });

  return useRegister(`grid:${plane.key}`, ops);
};
