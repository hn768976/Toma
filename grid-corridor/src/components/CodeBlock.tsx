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
import { driftedPosition, type BlockSpec, type CodeEvent } from "../layout";
import { LAYER, useRegister, type DrawOp } from "../scene";
import { buildCodeBlockSprite, buildEquationSprite } from "../sprites";
import type { Bucket, Palette } from "../variants";

type Props = {
  spec: BlockSpec;
  plane: Plane;
  palette: Palette;
  buckets: Bucket[];
  /** How hard this variant fades elements with depth. */
  depthDimming: number;
  frame: number;
  rollDirection: number;
  fontFamily: string;
  /** Live line replacements active on this block this frame. */
  overrides: Record<number, string>;
};

/**
 * A dense rectangle of invented monospace text, or — in the equation text
 * layer — a fragment of invented notation. The sprite is laid out once and
 * blitted, because laying out multi-line text at 4K every frame is the one
 * thing that will not survive a render.
 */
export const CodeBlock: React.FC<Props> = ({
  spec,
  plane,
  palette,
  buckets,
  depthDimming,
  frame,
  rollDirection,
  fontFamily,
  overrides,
}) => {
  const overrideKey = useMemo(
    () =>
      Object.keys(overrides)
        .sort()
        .map((k) => `${k}=${overrides[Number(k)]}`)
        .join("|"),
    [overrides],
  );

  const sprite = useMemo(() => {
    if (spec.kind === "equation") {
      return buildEquationSprite(
        { seed: spec.id, rows: spec.lineCount, fontSize: spec.fontSize * 1.5 },
        palette,
      );
    }
    return buildCodeBlockSprite(
      {
        seed: spec.id,
        lineCount: spec.lineCount,
        fontSize: spec.fontSize,
        dense: spec.dense,
        overrides,
      },
      palette,
      fontFamily,
    );
    // overrideKey stands in for `overrides`: identical content, stable string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, palette, fontFamily, overrideKey]);

  const pos = driftedPosition(
    plane,
    spec.u,
    spec.v,
    spec.speed,
    frame,
    rollDirection,
  );
  const radius = Math.hypot(sprite.width, sprite.height) / 2;
  const ops: DrawOp[] = [];

  for (const copy of tileCopies(plane, pos.u, pos.v, radius)) {
    const d = depthAt(plane, copy.x, copy.y);
    const weights = bucketWeights(d, buckets.length);
    const base = depthOpacity(d, depthDimming) * 0.92;
    for (let b = 0; b < buckets.length; b++) {
      const alpha = base * weights[b];
      if (alpha <= 0.004) continue;
      ops.push({
        order: LAYER.text,
        bucket: buckets[b].key,
        alpha,
        fn: (ctx, res) => {
          ctx.setTransform(res, 0, 0, res, 0, 0);
          clipToPlane(ctx, plane);
          setPlaneTransform(ctx, res, plane.m);
          ctx.translate(copy.x, copy.y);
          ctx.rotate(spec.rotation);
          ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
        },
      });
    }
  }

  return useRegister(spec.id, ops);
};

/** The line replacements affecting one block at one frame. */
export const overridesForBlock = (
  events: CodeEvent[],
  blockId: string,
  frame: number,
  lineText: (event: CodeEvent) => string,
): Record<number, string> => {
  const out: Record<number, string> = {};
  for (const e of events) {
    if (e.blockId !== blockId) continue;
    if (frame < e.startFrame || frame >= e.startFrame + e.duration) continue;
    out[e.line] = lineText(e);
  }
  return out;
};
