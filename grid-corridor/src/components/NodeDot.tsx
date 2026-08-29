import React from "react";
import { DURATION_IN_FRAMES } from "../constants";
import {
  bucketWeights,
  clipToPlane,
  depthAt,
  depthOpacity,
  setPlaneTransform,
  tileCopies,
  type Plane,
} from "../geometry";
import { driftedPosition, type DotSpec } from "../layout";
import { LAYER, useRegister, type DrawOp } from "../scene";
import type { Bucket, Palette } from "../variants";

type Props = {
  spec: DotSpec;
  plane: Plane;
  palette: Palette;
  buckets: Bucket[];
  glow: Bucket;
  frame: number;
  rollDirection: number;
  /** One pre-rendered radial falloff per tone, blitted at whatever size. */
  halos: Record<DotSpec["tone"], HTMLCanvasElement>;
};

/**
 * A bright point on a plane. Some carry a soft halo, some are sharp; all pulse
 * on a seeded sine whose period divides the loop.
 */
export const NodeDot: React.FC<Props> = ({
  spec,
  plane,
  palette,
  buckets,
  glow,
  frame,
  rollDirection,
  halos,
}) => {
  const pulse =
    0.58 +
    0.42 *
      Math.sin(
        Math.PI * 2 * ((spec.pulseK * frame) / DURATION_IN_FRAMES + spec.pulsePhase),
      );
  const colour =
    spec.tone === "white"
      ? palette.nodeWhite
      : spec.tone === "accent"
        ? palette.nodeAccent
        : palette.accent;
  const halo = halos[spec.tone];
  const pos = driftedPosition(plane, spec.u, spec.v, spec.speed, frame, rollDirection);
  const haloR = spec.radius * 6;
  const ops: DrawOp[] = [];

  const drawCore = (
    ctx: CanvasRenderingContext2D,
    res: number,
    u: number,
    v: number,
  ) => {
    ctx.setTransform(res, 0, 0, res, 0, 0);
    clipToPlane(ctx, plane);
    setPlaneTransform(ctx, res, plane.m);
    if (spec.halo) {
      ctx.drawImage(halo, u - haloR, v - haloR, haloR * 2, haloR * 2);
    }
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(u, v, spec.radius, 0, Math.PI * 2);
    ctx.fill();
  };

  for (const copy of tileCopies(plane, pos.u, pos.v, haloR)) {
    const d = depthAt(plane, copy.x, copy.y);
    const weights = bucketWeights(d, buckets.length);
    const base = depthOpacity(d) * pulse;
    for (let b = 0; b < buckets.length; b++) {
      const alpha = base * weights[b];
      if (alpha <= 0.004) continue;
      ops.push({
        order: LAYER.dot,
        bucket: buckets[b].key,
        alpha,
        fn: (ctx, res) => drawCore(ctx, res, copy.x, copy.y),
      });
    }
    // Node dots are the main source of bloom.
    ops.push({
      order: LAYER.dot,
      bucket: glow.key,
      alpha: base * 0.75,
      fn: (ctx, res) => {
        ctx.setTransform(res, 0, 0, res, 0, 0);
        clipToPlane(ctx, plane);
        setPlaneTransform(ctx, res, plane.m);
        const r = haloR * 1.3;
        ctx.drawImage(halo, copy.x - r, copy.y - r, r * 2, r * 2);
      },
    });
  }

  return useRegister(spec.id, ops);
};
