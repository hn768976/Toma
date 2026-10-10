import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useRemotionEnvironment } from "remotion";
import { HEIGHT, WIDTH } from "./constants";

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  /** Backing-store size in pixels. */
  w: number,
  h: number,
  /** backing pixels per 4K design pixel (design space is 3840x2160). */
  k: number,
) => void;

/**
 * A full-frame canvas whose backing store matches the render resolution
 * (devicePixelRatio == the --scale of the render), so a 1/3-scale preview
 * really draws 1280x720 and a 4K render draws 3840x2160. Drawing is a pure
 * function of the frame, done synchronously in a layout effect.
 */
export const Canvas2D: React.FC<{ draw: DrawFn }> = ({ draw }) => {
  const frame = useCurrentFrame();
  const { isRendering } = useRemotionEnvironment();
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = isRendering
    ? window.devicePixelRatio
    : Math.min(window.devicePixelRatio, 0.5); // keep the Studio responsive
  const w = Math.round(WIDTH * dpr);
  const h = Math.round(HEIGHT * dpr);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    draw(ctx, frame, w, h, w / WIDTH);
  }, [draw, frame, w, h]);

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      style={{ width: WIDTH, height: HEIGHT, display: "block", background: "#000" }}
    />
  );
};
