import React, { useCallback } from "react";
import { CanvasLayer } from "./CanvasLayer";

/**
 * Depth of field. The ring art has already been split across four buffers by
 * how far each *segment* sits from the sharp band; here each buffer is
 * blurred exactly once and the four are added together.
 *
 * Bucketing per segment rather than per ring is the whole point: a single
 * ring that crosses the band is sharp where it crosses and soft at both ends,
 * which is what a real lens does. Blurring whole rings uniformly loses it.
 */
export const FocusPass: React.FC<{
  buckets: HTMLCanvasElement[];
  blurPx: number[];
}> = ({ buckets, blurPx }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < buckets.length; i++) {
        const px = blurPx[i] ?? 0;
        ctx.filter = px > 0.5 ? `blur(${px.toFixed(2)}px)` : "none";
        ctx.drawImage(buckets[i], 0, 0);
      }
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
    },
    [buckets, blurPx],
  );

  return <CanvasLayer draw={draw} />;
};
