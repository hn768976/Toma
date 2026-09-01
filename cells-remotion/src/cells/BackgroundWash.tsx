import React from "react";
import { AbsoluteFill } from "remotion";
import { useCanvas2D } from "./useCanvas2D";
import type { Variant } from "./variants";

/**
 * A near-flat field in the variant's background tone, with one very subtle
 * gradient anchored in a corner. No texture, no pattern.
 */
export const BackgroundWash: React.FC<{
  variant: Variant;
  width: number;
  height: number;
}> = ({ variant, width, height }) => {
  const ref = useCanvas2D(
    (ctx) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = variant.palette.background;
      ctx.fillRect(0, 0, width, height);

      const [ax, ay] = variant.tintAnchor;
      const cx = width * ax;
      const cy = height * ay;
      const radius = Math.hypot(width, height) * 0.95;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      const tint = variant.palette.backgroundTint;
      gradient.addColorStop(0, tint);
      gradient.addColorStop(1, `${tint}00`);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
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
