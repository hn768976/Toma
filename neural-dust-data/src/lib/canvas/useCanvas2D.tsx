import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useRenderDpr } from "../three/ThreeLook";

export type Draw2D = (ctx: CanvasRenderingContext2D, frame: number, pw: number, ph: number, scale: number) => void;

/**
 * One full-frame <canvas>, backing store at the render resolution
 * (composition size x devicePixelRatio). `draw` is called synchronously for
 * every frame and must paint the whole frame from `frame` alone.
 */
export const Canvas2DLook: React.FC<{ draw: Draw2D }> = ({ draw }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const dpr = useRenderDpr();
  const ref = useRef<HTMLCanvasElement>(null);
  const pw = Math.floor(width * dpr);
  const ph = Math.floor(height * dpr);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d", { alpha: false, willReadFrequently: false });
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    draw(ctx, frame, pw, ph, pw / width);
  }, [draw, frame, pw, ph, width]);
  return <canvas ref={ref} width={pw} height={ph} style={{ width, height, display: "block" }} />;
};
