import { useMemo } from "react";
import { useCanvasPaint } from "../lib/canvas";
import { lowResUpscale } from "../lib/passes";

export type GlowPoolProps = {
  /**
   * The shared low-resolution colour field for this frame. It is computed once
   * per frame by the scene and handed to every layer that needs it, so the
   * pools the eye sees behind the word are exactly the pools tinting the
   * word's outer glow.
   */
  field: HTMLCanvasElement;
  width: number;
  height: number;
};

/**
 * Broad soft pools of coloured light bleeding onto the black background.
 *
 * All the work happens in `paintGlowField` at 1/8 resolution; this layer only
 * upscales, which is what makes the pools soft.
 */
export const GlowPool: React.FC<GlowPoolProps> = ({ field, width, height }) => {
  const style = useMemo(
    () =>
      ({
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }) as const,
    [],
  );

  const ref = useCanvasPaint(
    (ctx) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.clearRect(0, 0, width, height);
      lowResUpscale(ctx, field, width, height);
      // A second, wider copy added on top gives the pools a bloom of their own
      // without a second field computation.
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.18;
      ctx.filter = `blur(${Math.round(height * 0.05)}px)`;
      lowResUpscale(ctx, field, width, height);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
    [field, width, height],
  );

  return <canvas ref={ref} width={width} height={height} style={style} />;
};
