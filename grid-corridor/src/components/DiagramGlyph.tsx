import React, { useMemo } from "react";
import {
  bucketWeights,
  clipToPlane,
  depthAt,
  depthOpacity,
  setPlaneTransform,
  tileCopies,
  type Plane,
} from "../geometry";
import { driftedPosition, type GlyphSpec } from "../layout";
import { LAYER, useRegister, type DrawOp } from "../scene";
import { buildDiagramSprite } from "../sprites";
import type { Bucket, DiagramSet, Palette } from "../variants";

type Props = {
  spec: GlyphSpec;
  plane: Plane;
  palette: Palette;
  buckets: Bucket[];
  /** How hard this variant fades elements with depth. */
  depthDimming: number;
  glow: Bucket;
  diagrams: DiagramSet;
  frame: number;
  rollDirection: number;
};

/**
 * A small technical drawing — thin strokes with circular nodes at the
 * vertices. Which vocabulary it is drawn from comes from the variant.
 */
export const DiagramGlyph: React.FC<Props> = ({
  spec,
  plane,
  palette,
  buckets,
  depthDimming,
  glow,
  diagrams,
  frame,
  rollDirection,
}) => {
  const sprite = useMemo(
    () =>
      buildDiagramSprite(
        { seed: spec.id, set: diagrams, size: spec.size },
        palette,
      ),
    [spec.id, spec.size, diagrams, palette],
  );

  const pos = driftedPosition(
    plane,
    spec.u,
    spec.v,
    spec.speed,
    frame,
    rollDirection,
  );
  const radius = sprite.width / 2;
  const ops: DrawOp[] = [];

  const blit = (
    ctx: CanvasRenderingContext2D,
    res: number,
    u: number,
    v: number,
    scale: number,
  ) => {
    ctx.setTransform(res, 0, 0, res, 0, 0);
    clipToPlane(ctx, plane);
    setPlaneTransform(ctx, res, plane.m);
    ctx.translate(u, v);
    ctx.rotate(spec.rotation);
    ctx.scale(scale, scale);
    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
  };

  for (const copy of tileCopies(plane, pos.u, pos.v, radius)) {
    const d = depthAt(plane, copy.x, copy.y);
    const weights = bucketWeights(d, buckets.length);
    const base = depthOpacity(d, depthDimming);
    for (let b = 0; b < buckets.length; b++) {
      const alpha = base * weights[b];
      if (alpha <= 0.004) continue;
      ops.push({
        order: LAYER.glyph,
        bucket: buckets[b].key,
        alpha,
        fn: (ctx, res) => blit(ctx, res, copy.x, copy.y, 1),
      });
    }
    ops.push({
      order: LAYER.glyph,
      bucket: glow.key,
      alpha: base * 0.2,
      fn: (ctx, res) => blit(ctx, res, copy.x, copy.y, 1.04),
    });
  }

  return useRegister(spec.id, ops);
};
