import React, { useLayoutEffect, useRef } from "react";
import { useVideoConfig } from "remotion";

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

/**
 * A full-frame canvas that is drawn exactly once, on commit. This is a still
 * — there is no frame loop — so every layer is just "set up a context, paint,
 * done".
 */
export const CanvasLayer: React.FC<{
  draw: DrawFn;
  blend?: string;
  opacity?: number;
}> = ({ draw, blend, opacity }) => {
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
  }, [draw, width, height]);

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
        mixBlendMode: blend as React.CSSProperties["mixBlendMode"],
        opacity,
      }}
    />
  );
};

/** Off-DOM buffer used for the blur brackets and the low-res background. */
export const makeBuffer = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};
