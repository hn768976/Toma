import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTES, type VariantName } from "./constants";
import { drawVortex } from "./draw";

export type DotVortexProps = {
  variant: VariantName;
};

export const DotVortex: React.FC<DotVortexProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const palette = PALETTES[variant] ?? PALETTES.gold;

  // useLayoutEffect, not useEffect: the draw has to be committed before
  // the browser paints the frame Remotion is about to capture.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    // alpha: false lets the compositor skip the transparency path; the
    // background is opaque black anyway.
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      return;
    }
    drawVortex({ ctx, frame, width, height, durationInFrames, palette });
  }, [frame, width, height, durationInFrames, palette]);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      {/*
        The backing store is always the composition's full pixel size, and
        never scaled by devicePixelRatio: under `--scale=0.5` Remotion
        renders the page at deviceScaleFactor 0.5, so the 4K canvas is
        downsampled into the 1080p capture. That supersampling is what
        keeps 1-4px dots clean in the preview.
      */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
