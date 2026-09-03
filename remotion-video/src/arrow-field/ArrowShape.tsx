/**
 * <ArrowShape> — the arrow layer.
 *
 * One arrow geometry, rasterised once per style, blitted ~55 times with a
 * transform. The arrow is a rectangular shaft with a triangular head drawn as
 * a single closed outline: a translucent fill under a brighter edge, so
 * overlapping arrows build density by layering rather than by glowing.
 *
 * Direction is not baked in. The sprite points down its own canvas and the
 * layer rotates it onto `axis`, which is the variant's signed drift vector —
 * so red arrows fall and green arrows rise from the same code path.
 *
 * Like <ShardField> this draws into the shared depth buffers and renders no
 * DOM, which is what lets a near arrow sit in front of a near shard while a
 * far arrow stays behind both.
 */

import React, { useLayoutEffect } from "react";
import { DepthBuffers } from "./depth";
import { AxisFrame, DriftElement } from "./geometry";
import { Sprite } from "./sprites";
import { drawDriftElements } from "./ShardField";
import { Corner } from "./variants";

export type ArrowShapeProps = {
  buffers: DepthBuffers | null;
  frame: number;
  /** Filled arrows — the body of the field. */
  filled: DriftElement[];
  /** Outline-only arrows, larger and lighter. Empty in v1. */
  outlined: DriftElement[];
  filledSprite: Sprite;
  outlineSprite: Sprite;
  axis: AxisFrame;
  corner: Corner;
};

export const ArrowShape: React.FC<ArrowShapeProps> = ({
  buffers,
  frame,
  filled,
  outlined,
  filledSprite,
  outlineSprite,
  axis,
  corner,
}) => {
  useLayoutEffect(() => {
    drawDriftElements({
      buffers,
      frame,
      elements: filled,
      sprites: [filledSprite],
      axis,
      corner,
    });
    if (outlined.length > 0) {
      drawDriftElements({
        buffers,
        frame,
        elements: outlined,
        sprites: [outlineSprite],
        axis,
        corner,
      });
    }
  });
  return null;
};
