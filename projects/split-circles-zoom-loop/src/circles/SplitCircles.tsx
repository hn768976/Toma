import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { LOOP_FRAMES } from "./constants";
import { COBALT_AQUA, VIOLET_PINK } from "./palettes";
import { drawScene } from "./scene";

export type SplitCirclesProps = { palette: "violet" | "cobalt" };

export const SplitCircles: React.FC<SplitCirclesProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const pal = palette === "cobalt" ? COBALT_AQUA : VIOLET_PINK;

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawScene(ctx, width, height, frame % LOOP_FRAMES, pal);
  }, [frame, width, height, pal]);

  return (
    <AbsoluteFill style={{ backgroundColor: pal.left }}>
      <canvas ref={ref} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
