import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { config } from "./config";
import { createBuffers, drawFrame } from "./render";

export type NeonStreaksProps = {
  /** Render without the opaque background, for a keyable alpha pass. */
  transparent?: boolean;
};

/**
 * The whole effect. Every pixel is a pure function of useCurrentFrame():
 * no requestAnimationFrame, no Date.now(), no CSS animation, no state that
 * survives a frame. Drawing happens in useLayoutEffect, which runs
 * synchronously before paint, so Remotion always captures a finished frame.
 */
export const NeonStreaks: React.FC<NeonStreaksProps> = ({
  transparent = false,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Buffers are scratch space only — reallocated when the resolution changes,
  // cleared at the top of every draw.
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
