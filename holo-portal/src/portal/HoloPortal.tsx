import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { CameraMode } from "./camera";
import { Buffers, createBuffers, renderScene } from "./scene";

export type HoloPortalProps = {
  cameraMode: CameraMode;
};

// Holographic data portal: a glowing HUD ring ignites on a plexus floor and
// streams icons / data streaks upward. Drawn with Canvas 2D through a small
// custom perspective camera; bloom and depth of field come from blurred
// quarter-resolution buffers composited additively.
export const HoloPortal: React.FC<HoloPortalProps> = ({ cameraMode }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buffersRef = useRef<Buffers | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!buffersRef.current) buffersRef.current = createBuffers(width, height);
    renderScene(ctx, buffersRef.current, width, height, frame, cameraMode);
  }, [frame, width, height, cameraMode]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000c23" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
