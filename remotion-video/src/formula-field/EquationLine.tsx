import React from "react";
import type { Instance } from "./field";
import type { Variant } from "./variant-types";
import { blitInstance } from "./blit";
import { getAtlas } from "./sprites";
import { useCanvasPass } from "./useCanvasPass";

/**
 * One formula line — a balanced equation, an integral, a law — placed into a
 * depth buffer. The layout with its subscripts and built-up structures was
 * done once when the sprite atlas was built; this is only ever a scaled blit.
 */
export const EquationLine: React.FC<{
  buffer: HTMLCanvasElement;
  variant: Variant;
  instance: Instance;
  weight: number;
  motionBlur: boolean;
  frameW: number;
  frameH: number;
}> = ({ buffer, variant, instance, weight, motionBlur, frameW, frameH }) => {
  useCanvasPass(() => {
    const ctx = buffer.getContext("2d");
    if (!ctx) return;
    const sprite = getAtlas(variant)[instance.notationIndex];
    if (!sprite) return;
    blitInstance(ctx, instance, sprite, weight, motionBlur, frameW, frameH);
  });
  return null;
};
