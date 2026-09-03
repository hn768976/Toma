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
 * Like the shard field this draws into the shared depth buffers and renders no
 * DOM, which is what lets a near arrow sit in front of a near shard while a
 * far arrow stays behind both.
 */

import React, { useLayoutEffect } from "react";
import { BUILD_OPTIONS, LOOP_FRAMES, VIEWPORT } from "./constants";
import { DepthBuffers } from "./depth";
import { AxisFrame, Corner, DriftElement } from "../lib/drift";
import { drawDriftElements } from "../lib/ShardField";
import { Sprite } from "../lib/sprite";

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
    const shared = {
      buffers,
      frame,
      loopFrames: LOOP_FRAMES,
      axis,
      corner,
      viewport: VIEWPORT,
      falloff: BUILD_OPTIONS.falloff,
    };
    drawDriftElements({ ...shared, elements: filled, sprites: [filledSprite] });
    if (outlined.length > 0) {
      drawDriftElements({
        ...shared,
        elements: outlined,
        sprites: [outlineSprite],
      });
    }
  });
  return null;
};
