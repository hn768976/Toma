import React from "react";
import { setPlaneTransform, tileCopies, type Plane } from "../geometry";
import { driftedPosition, type FlareSpec } from "../layout";
import { LAYER, useRegister, type DrawOp } from "../scene";
import type { Bucket, Palette } from "../variants";

type Props = {
  spec: FlareSpec;
  plane: Plane;
  palette: Palette;
  focusBucket: Bucket;
  glow: Bucket;
  frame: number;
  rollDirection: number;
  halo: HTMLCanvasElement;
};

/** A speck that blows out for three or four frames, then is gone. */
export const Flare: React.FC<Props> = ({
  spec,
  plane,
  palette,
  focusBucket,
  glow,
  frame,
  rollDirection,
  halo,
}) => {
  const local = (frame - spec.startFrame) / spec.duration;
  const active = local >= 0 && local < 1;
  const intensity = active ? Math.sin(local * Math.PI) : 0;
  const ops: DrawOp[] = [];

  if (intensity > 0.01) {
    const pos = driftedPosition(plane, spec.u, spec.v, 1, frame, rollDirection);
    const r = spec.size * (0.6 + intensity * 0.6);
    for (const copy of tileCopies(plane, pos.u, pos.v, r)) {
      const paint = (
        ctx: CanvasRenderingContext2D,
        res: number,
        scale: number,
      ) => {
        setPlaneTransform(ctx, res, plane.m);
        const s = r * scale;
        ctx.drawImage(halo, copy.x - s, copy.y - s, s * 2, s * 2);
        ctx.fillStyle = palette.nodeWhite;
        ctx.beginPath();
        ctx.arc(copy.x, copy.y, Math.max(1.5, r * 0.1), 0, Math.PI * 2);
        ctx.fill();
      };
      ops.push({
        order: LAYER.flare,
        bucket: focusBucket.key,
        alpha: intensity,
        fn: (ctx, res) => paint(ctx, res, 1),
      });
      ops.push({
        order: LAYER.flare,
        bucket: glow.key,
        alpha: intensity * 0.9,
        fn: (ctx, res) => paint(ctx, res, 1.6),
      });
    }
  }

  return useRegister(spec.id, ops);
};
