import React from "react";
import { AbsoluteFill } from "remotion";
import { withAlpha } from "./color";
import { useCanvas2D } from "./useCanvas2D";
import type { Variant } from "./variants";

/**
 * A soft corner falloff in the variant's own background tone.
 *
 * v1 needs none — a vignette on near-white just looks like a dirty lens. v2 is
 * near-black and goes flat without one.
 */
export const VignettePass: React.FC<{
  variant: Variant;
  width: number;
  height: number;
}> = ({ variant, width, height }) => {
  const ref = useCanvas2D(
    (ctx) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const inner = Math.min(width, height) * 0.36;
      const outer = Math.hypot(width, height) * 0.6;
      const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
      const tone = variant.palette.background;
      gradient.addColorStop(0, withAlpha(tone, 0));
      gradient.addColorStop(0.62, withAlpha(tone, variant.vignette * 0.42));
      gradient.addColorStop(1, withAlpha(tone, variant.vignette));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    },
    [variant, width, height],
  );

  return (
    <AbsoluteFill>
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
