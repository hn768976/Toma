import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import { useFontsReady } from "./fonts";

export type CanvasDraw = (ctx: CanvasRenderingContext2D, frame: number, w: number, h: number) => void;

/** A 2D canvas at the physical output resolution, redrawn from the frame number only. */
export const CanvasStage: React.FC<{ draw: CanvasDraw; background: string }> = ({ draw, background }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const fontsReady = useFontsReady();
  const ref = useRef<HTMLCanvasElement>(null);
  const { isRendering } = getRemotionEnvironment();
  const devicePx = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const scale = isRendering ? devicePx : Math.min(devicePx, 1920 / width);
  const physW = Math.round(width * scale);
  const physH = Math.round(height * scale);

  useLayoutEffect(() => {
    if (!fontsReady || !ref.current) return;
    const ctx = ref.current.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    draw(ctx, frame, physW, physH);
  }, [frame, fontsReady, draw, physW, physH]);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas ref={ref} width={physW} height={physH} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
