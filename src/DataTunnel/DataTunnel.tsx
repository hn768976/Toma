import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { config } from "./config";
import { createBuffers, drawFrame } from "./render";

export type DataTunnelProps = {
  /** Render without the background fill and vignette, for a keyable pass. */
  transparent?: boolean;
};

/**
 * A flight down a corridor of glowing dot grids. Every pixel is a pure
 * function of useCurrentFrame(): no requestAnimationFrame, no Date.now(), no
 * CSS animation, no state carried between frames.
 */
export const DataTunnel: React.FC<DataTunnelProps> = ({
  transparent = false,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const buffers = useMemo(() => createBuffers(width, height), [width, height]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, buffers, frame, durationInFrames, { transparent });
  }, [frame, buffers, durationInFrames, transparent]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : config.palette.background,
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
