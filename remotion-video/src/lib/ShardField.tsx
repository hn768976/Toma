/**
 * <ShardField> — translucent overlapping polygons drifting on a shared axis,
 * with depth-driven scale, speed, opacity and blur.
 *
 * Subject-agnostic. It knows nothing about what the polygons represent, has no
 * palette (colour arrives pre-baked in the sprites), and has no opinion about
 * which way is forward (direction arrives in `axis` as a signed vector). Point
 * it at a different sprite set and it is a different abstract background:
 * shards, leaves, embers, paper, rain.
 *
 * It renders no DOM. It draws into shared depth buffers and returns null, so
 * several fields can share one buffer set and interleave correctly by depth
 * instead of one group sitting flatly on top of another.
 *
 * Typical wiring, as a pipeline of siblings — React flushes sibling layout
 * effects in tree order, which is the ordering guarantee this relies on:
 *
 *   <ShardField     buffers={buffers} ... />
 *   <ShardField     buffers={buffers} ... />   // a second group, same buffers
 *   <DepthComposite buffers={buffers} targetRef={fieldRef} frame={frame} />
 */

import React, { useLayoutEffect } from "react";
import { DepthBuffers } from "./depthBuffers";
import {
  AxisFrame,
  Corner,
  DensityFalloff,
  DriftElement,
  Viewport,
  placeElement,
} from "./drift";
import { Sprite, blitSprite } from "./sprite";

/** Below this the element is deep inside the open corner and contributes nothing. */
const ALPHA_CUTOFF = 0.004;

export type ShardFieldProps = {
  buffers: DepthBuffers | null;
  /** Already reduced modulo the loop length by the caller. */
  frame: number;
  loopFrames: number;
  elements: DriftElement[];
  sprites: Sprite[];
  axis: AxisFrame;
  corner: Corner;
  viewport: Viewport;
  falloff?: DensityFalloff;
};

/**
 * The draw pass on its own, for callers that want to run several groups from
 * one effect rather than as separate components.
 */
export const drawDriftElements = ({
  buffers,
  frame,
  loopFrames,
  elements,
  sprites,
  axis,
  corner,
  viewport,
  falloff,
}: ShardFieldProps) => {
  if (!buffers) return;
  buffers.begin(frame);
  const t = (frame % loopFrames) / loopFrames;

  for (const el of elements) {
    const place = placeElement(el, axis, corner, t, { viewport, falloff });
    if (place.alpha < ALPHA_CUTOFF) continue;
    // Cull anything wholly outside the frame, including its wrap margin.
    if (
      place.x < -el.halfExtent ||
      place.x > viewport.width + el.halfExtent ||
      place.y < -el.halfExtent ||
      place.y > viewport.height + el.halfExtent
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

export const ShardField: React.FC<ShardFieldProps> = (props) => {
  useLayoutEffect(() => {
    drawDriftElements(props);
  });
  return null;
};
