import React from "react";
import {
  bucketWeights,
  clipToPlane,
  depthAt,
  depthOpacity,
  setPlaneTransform,
  tileCopies,
  type Plane,
} from "../geometry";
import { driftedPosition, type ConnectorSpec } from "../layout";
import { LAYER, useRegister, type DrawOp } from "../scene";
import { withAlpha } from "../sprites";
import type { Bucket, Palette } from "../variants";

type Props = {
  spec: ConnectorSpec;
  plane: Plane;
  palette: Palette;
  buckets: Bucket[];
  /** How hard this variant fades elements with depth. */
  depthDimming: number;
  frame: number;
  rollDirection: number;
};

/** A thin faint line from a node dot to the diagram glyph nearest it. */
export const Connector: React.FC<Props> = ({
  spec,
  plane,
  palette,
  buckets,
  depthDimming,
  frame,
  rollDirection,
}) => {
  const pos = driftedPosition(
    plane,
    spec.u,
    spec.v,
    spec.speed,
    frame,
    rollDirection,
  );
  const length = Math.hypot(spec.du, spec.dv);
  const ops: DrawOp[] = [];

  for (const copy of tileCopies(plane, pos.u, pos.v, length)) {
    const d = depthAt(plane, copy.x + spec.du / 2, copy.y + spec.dv / 2);
    const weights = bucketWeights(d, buckets.length);
    const base = depthOpacity(d, depthDimming) * 0.34;
    for (let b = 0; b < buckets.length; b++) {
      const alpha = base * weights[b];
      if (alpha <= 0.004) continue;
      ops.push({
        order: LAYER.connector,
        bucket: buckets[b].key,
        alpha,
        fn: (ctx, res) => {
          ctx.setTransform(res, 0, 0, res, 0, 0);
          clipToPlane(ctx, plane);
          setPlaneTransform(ctx, res, plane.m);
          ctx.strokeStyle = withAlpha(palette.diagram, 0.75);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(copy.x, copy.y);
          ctx.lineTo(copy.x + spec.du, copy.y + spec.dv);
          ctx.stroke();
        },
      });
    }
  }

  return useRegister(spec.id, ops);
};
