/**
 * The finish: bloom on the horizon glow and the brightest elements, then a
 * vignette, then fine grain. Runs last, reading the finished frame back out of
 * the target canvas.
 */
import React, { useMemo } from "react";
import { BloomPass } from "../lib/bloomPass";
import { useCanvasLayer } from "../lib/canvasLayers";
import { GrainPass } from "../lib/grainPass";
import { VignettePass } from "../lib/vignettePass";

export interface FinishPassProps {
  order: number;
  width: number;
  height: number;
  frame: number;
  loop: number;
  seed: string;
  palette: Record<string, string>;
  bloom: { radius: number; strength: number };
  vignette: number;
  grainAlpha: number;
  /** Tile-pool size for the grain. Must divide the loop length. */
  grainPool?: number;
}

export const FinishPass: React.FC<FinishPassProps> = ({
  order,
  width,
  height,
  frame,
  loop,
  seed,
  palette,
  bloom,
  vignette,
  grainAlpha,
  grainPool = 25,
}) => {
  const bloomPass = useMemo(() => new BloomPass(width, height, 0.25), [width, height]);
  const vignettePass = useMemo(() => new VignettePass(), []);
  const grainPass = useMemo(() => new GrainPass(`${seed}-grain`, 512), [seed]);

  useCanvasLayer({
    id: "finish-pass",
    order,
    draw: (ctx) => {
      bloomPass.apply(ctx, ctx.canvas, bloom);
      vignettePass.apply(ctx, width, height, {
        amount: vignette,
        color: palette.shadow,
      });
      grainPass.apply(ctx, width, height, frame, {
        alpha: grainAlpha,
        poolSize: grainPool,
        loopLength: loop,
      });
    },
  });
  return null;
};
