import React, { useLayoutEffect, useRef } from "react";

/**
 * Draws once per React render. There is no requestAnimationFrame and no state:
 * the frame number is the only input, so every render is reproducible and
 * `remotion render` is deterministic.
 */
export const HudCanvas: React.FC<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}> = ({ width, height, draw }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.save();
    draw(ctx);
    ctx.restore();
  });

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        display: "block",
      }}
    />
  );
};
