/**
 * <SparkLayer> — small bright motes drifting among the shards and arrows.
 *
 * These are the only elements in the frame that read as light sources, which
 * is why they are additively blended and why the bloom pass picks them up.
 * They are drawn straight onto the flattened field canvas rather than into a
 * depth buffer: sparks want to stay sharp at every depth.
 *
 * Twinkle is a raised sine on a whole number of cycles per loop, so a spark
 * is at exactly the same brightness on frame 0 and frame 330.
 */

import React, { useLayoutEffect } from "react";
import { LOOP_FRAMES } from "./constants";
import { AxisFrame, DriftElement, TAU, placeElement } from "./geometry";
import { Sprite, blitSprite } from "./sprites";
import { Corner } from "./variants";

export type SparkLayerProps = {
  targetRef: React.RefObject<HTMLCanvasElement | null>;
  frame: number;
  elements: DriftElement[];
  sprite: Sprite;
  axis: AxisFrame;
  corner: Corner;
};

export const SparkLayer: React.FC<SparkLayerProps> = ({
  targetRef,
  frame,
  elements,
  sprite,
  axis,
  corner,
}) => {
  useLayoutEffect(() => {
    const ctx = targetRef.current?.getContext("2d");
    if (!ctx) return;
    const t = (frame % LOOP_FRAMES) / LOOP_FRAMES;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const el of elements) {
      const place = placeElement(el, axis, corner, t);
      // A sharper curve than the field's breathe: mostly dim, briefly bright.
      const phase = 0.5 + 0.5 * Math.sin(TAU * el.wobbleCycles * t + el.wobblePhase);
      const twinkle = 0.12 + 0.88 * Math.pow(phase, 2.4);
      const alpha = place.alpha * twinkle;
      if (alpha < 0.006) continue;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.save();
      ctx.translate(place.x, place.y);
      blitSprite(ctx, sprite, el.sizeMul);
      ctx.restore();
    }
    ctx.restore();
  });
  return null;
};
