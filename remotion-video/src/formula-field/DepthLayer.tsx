import React from "react";
import type { Instance } from "./field";
import type { Variant } from "./variants";
import { EquationLine } from "./EquationLine";
import { NotationGlyph } from "./NotationGlyph";
import { useCanvasPass } from "./useCanvasPass";

const ClearPass: React.FC<{ buffer: HTMLCanvasElement }> = ({ buffer }) => {
  useCanvasPass(() => {
    const ctx = buffer.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, buffer.width, buffer.height);
  });
  return null;
};

export type Bucket = "far" | "mid" | "near";

/**
 * One of the three depth-of-field buffers.
 *
 * Glyphs are bucketed by depth and every glyph in a bucket lands in the same
 * offscreen canvas, which the compositor blurs ONCE. Blurring seventy glyphs
 * individually would be unusably slow at 4K. Glyphs near a bucket boundary are
 * drawn into both neighbours with complementary weights, so the blur gradates
 * smoothly even though only three blurs are ever performed.
 */
export const DepthLayer: React.FC<{
  buffer: HTMLCanvasElement;
  variant: Variant;
  bucket: Bucket;
  glyphs: Instance[];
  /** The nearest bucket carries the motion-blur trails. */
  motionBlur: boolean;
  frameW: number;
  frameH: number;
}> = ({ buffer, variant, bucket, glyphs, motionBlur, frameW, frameH }) => {
  const weightOf = (g: Instance) =>
    bucket === "far" ? g.wFar : bucket === "mid" ? g.wMid : g.wNear;

  return (
    <>
      <ClearPass buffer={buffer} />
      {glyphs.map((g) => {
        const weight = weightOf(g);
        if (weight <= 0.004) return null;
        const props = { buffer, variant, instance: g, weight, motionBlur, frameW, frameH };
        return g.kind === "equation" ? (
          <EquationLine key={g.key} {...props} />
        ) : (
          <NotationGlyph key={g.key} {...props} />
        );
      })}
    </>
  );
};
