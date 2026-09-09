import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { drawGlitterRing } from "./draw";
import { getParticleField } from "./field";
import { PALETTES } from "./palettes";

export type GlitterRingProps = {
  /** Which version to render: gold, silver/platinum or rose gold. */
  palette: keyof typeof PALETTES;
  /** Seeds the particle field; change it for a different arrangement. */
  seed: string;
};

export const GlitterRing: React.FC<GlitterRingProps> = ({ palette, seed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // useLayoutEffect, not useEffect: the frame must be fully painted before
  // Remotion captures it.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      return;
    }
    drawGlitterRing({
      ctx,
      width,
      height,
      frame,
      palette: PALETTES[palette],
      field: getParticleField(`${seed}:${palette}`),
    });
  }, [frame, width, height, palette, seed]);

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTES[palette].backgroundOuter }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};

export const glitterRingDefaults: GlitterRingProps = {
  palette: "gold",
  seed: "glitter-ring",
};
