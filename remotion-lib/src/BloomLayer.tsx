import React from "react";
import {useCanvas2D} from "./use-canvas";

/**
 * Additive bloom for a source canvas, drawn as a sibling layer.
 *
 * The blur is done on a heavily downscaled copy and then stretched back with a
 * light CSS blur on top: blurring 8.3 megapixels per frame is not affordable in
 * a software rasteriser, and a 1/4-scale blur upsampled is visually
 * indistinguishable at bloom radii. `mixBlendMode: screen` supplies the
 * additive part, so bright source pixels bloom proportionally more than dim
 * ones without needing a separate "bright only" pass.
 */
export const BloomLayer: React.FC<{
  source: React.MutableRefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  /** Linear downscale factor of the blur buffer. 4 = quarter resolution. */
  downscale?: number;
  /** Blur radius applied at the downscaled resolution. */
  blur?: number;
  /** Additional CSS blur applied when the buffer is stretched back up. */
  spread?: number;
  opacity?: number;
  /** Redraw trigger. Pass the current frame. */
  frame: number;
}> = ({source, width, height, downscale = 4, blur = 2, spread = 5, opacity = 0.5, frame}) => {
  const w = Math.ceil(width / downscale);
  const h = Math.ceil(height / downscale);

  const ref = useCanvas2D(w, h, (ctx) => {
    void frame;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const src = source.current;
    if (!src) return;
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(src, 0, 0, w, h);
    ctx.filter = "none";
  });

  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        mixBlendMode: "screen",
        filter: `blur(${spread}px)`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};
