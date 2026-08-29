import React from "react";
import type { Instance } from "./field";
import type { Variant } from "./variant-types";
import { blitInstance } from "./blit";
import { getAtlas } from "./sprites";
import { useCanvasPass } from "./useCanvasPass";

/**
 * One drawn glyph — a skeletal structure or a physics diagram — placed into a
 * depth buffer. Same blit as an equation line; kept separate because the two
 * carry different notation and are worth reading apart in the tree.
 */
export const NotationGlyph: React.FC<{
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
