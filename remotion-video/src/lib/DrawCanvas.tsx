/**
 * A canvas that redraws exactly once per React render.
 *
 * In Remotion every frame is an independent React render, so this is all
 * the scheduling a canvas animation needs — no requestAnimationFrame, no
 * state, no time source other than the frame number handed to `draw`.
 * The effect is a layout effect so the canvas is painted before the
 * browser composites, which keeps the captured frame in step with the
 * React tree that produced it.
 *
 * The backing store is `width` x `height`; the element is stretched to
 * fill its parent. Passing a backing store smaller than the display size
 * is a deliberate and useful trick for low-frequency layers (blur, grain,
 * gradients), which cost a fraction as much and look identical.
 */
import React, { useLayoutEffect, useRef } from "react";

export const DrawCanvas: React.FC<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
  style?: React.CSSProperties;
}> = ({ width, height, draw, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    draw(ctx);
  });

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        ...style,
      }}
    />
  );
};
