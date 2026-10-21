import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useBacking } from "./backing";

export type Draw2D = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  size: { bw: number; bh: number; k: number },
) => void;

/**
 * Full-frame Canvas 2D layer, redrawn synchronously for every frame. The
 * context is pre-scaled so `draw` works in 4K units (3840x2160).
 */
export const Canvas2D: React.FC<{
  draw: Draw2D;
  ready?: boolean;
  style?: React.CSSProperties;
}> = ({ draw, ready = true, style }) => {
  const frame = useCurrentFrame();
  const { bw, bh, k } = useBacking();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, bw, bh);
    if (!ready) return;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    draw(ctx, frame, { bw, bh, k });
  }, [frame, bw, bh, k, draw, ready]);

  return (
    <AbsoluteFill style={style}>
      <canvas ref={ref} width={bw} height={bh} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
