/**
 * <ShardField> — translucent overlapping polygons drifting on a shared axis,
 * with depth-driven scale, speed, opacity and blur.
 *
 * Subject-agnostic: it knows nothing about arrows, nothing about a palette,
 * and nothing about which way is "forward". Colour arrives pre-baked in the
 * sprites, direction arrives in `axis`, and the frame's density distribution
 * arrives in `corner`. Point it at a different sprite set and it is a
 * different abstract background.
 *
 * It renders no DOM of its own. It draws into the shared depth buffers and
 * returns null, so shards and arrows interleave correctly by depth instead of
 * one group sitting flatly on top of the other.
 */

import React, { useLayoutEffect } from "react";
import { LOOP_FRAMES } from "./constants";
import { DepthBuffers } from "./depth";
import { AxisFrame, DriftElement, placeElement } from "./geometry";
import { HEIGHT, WIDTH } from "./constants";
import { Sprite, blitSprite } from "./sprites";
import { Corner } from "./variants";

/** Below this the element is inside the open corner and contributes nothing. */
const ALPHA_CUTOFF = 0.004;

export type DriftLayerProps = {
  buffers: DepthBuffers | null;
  frame: number;
  elements: DriftElement[];
  sprites: Sprite[];
  axis: AxisFrame;
  corner: Corner;
};

/**
 * Shared draw pass. Kept separate from the component so the arrow layer can
 * reuse it verbatim — the two layers differ only in their sprites and seeds.
 */
export const drawDriftElements = ({
  buffers,
  frame,
  elements,
  sprites,
  axis,
  corner,
}: DriftLayerProps) => {
  if (!buffers) return;
  buffers.begin(frame);
  const t = (frame % LOOP_FRAMES) / LOOP_FRAMES;

  for (const el of elements) {
    const place = placeElement(el, axis, corner, t);
    if (place.alpha < ALPHA_CUTOFF) continue;
    // Cull anything wholly outside the frame, including its wrap margin.
    if (
      place.x < -el.halfExtent ||
      place.x > WIDTH + el.halfExtent ||
      place.y < -el.halfExtent ||
      place.y > HEIGHT + el.halfExtent
    ) {
      continue;
    }
    const ctx = buffers.contextFor(el.band);
    ctx.save();
    ctx.globalAlpha = place.alpha;
    ctx.translate(place.x, place.y);
    ctx.rotate(place.rotation);
    blitSprite(ctx, sprites[el.spriteIndex], el.sizeMul, el.widthMul);
    ctx.restore();
  }
};

export const ShardField: React.FC<DriftLayerProps> = (props) => {
  useLayoutEffect(() => {
    drawDriftElements(props);
  });
  return null;
};
