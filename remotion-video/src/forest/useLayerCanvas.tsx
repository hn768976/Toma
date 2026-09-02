import React, { useLayoutEffect, useRef } from "react";

export type LayerDraw = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

/**
 * Mounts a full-bleed <canvas> and runs `draw` against it exactly once per
 * React render, synchronously before paint.
 *
 * There is deliberately no requestAnimationFrame and no state: the component
 * re-renders because useCurrentFrame() changed, the effect redraws, and the
 * pixels are a pure function of the frame number. That is what lets Remotion
 * render frames out of order across workers and still get a stable result.
 *
 * `width`/`height` are the canvas *backing store* size. Layers whose content
 * is entirely soft gradient (sky, fog) use a smaller backing store and let the
 * browser upscale it — nothing is lost and it is dramatically cheaper at 4K.
 */
export const useLayerCanvas = (
  width: number,
  height: number,
  draw: LayerDraw,
) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    drawRef.current(ctx, width, height);
    ctx.restore();
  });

  return ref;
};

export const LayerCanvas: React.FC<{
  width: number;
  height: number;
  draw: LayerDraw;
  /** CSS blur applied to the composited layer, in on-screen pixels. */
  style?: React.CSSProperties;
}> = ({ width, height, draw, style }) => {
  const ref = useLayerCanvas(width, height, draw);
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        ...style,
      }}
    />
  );
};
