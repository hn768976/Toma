import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { TileRenderer } from "./scene/TileRenderer";
import { cameraFor, LOOK, MOTION_BLUR, VariantName } from "./variants";

export type TileWaveProps = {
  variant: VariantName;
};

export const TileWave: React.FC<TileWaveProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TileRenderer | null>(null);
  // The composition is 4K. The scene is resolution independent, so the canvas
  // renders natively at the output resolution: full 3840x2160 at --scale=1,
  // 1920x1080 at --scale=0.5 (Remotion's scale sets devicePixelRatio).
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);

  // Draw synchronously in a layout effect so the frame is complete before
  // Remotion captures it. Errors propagate and fail the render loudly.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!rendererRef.current || rendererRef.current.width !== bw || rendererRef.current.height !== bh) {
      rendererRef.current?.dispose();
      rendererRef.current = new TileRenderer(canvas, LOOK);
    }
    rendererRef.current.render(frame, cameraFor(variant), MOTION_BLUR.samples, MOTION_BLUR.shutter);
  }, [frame, variant, bw, bh]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#fbeef2" }}>
      <canvas
        ref={canvasRef}
        width={bw}
        height={bh}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
