import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { drawFrame } from "./draw";
import { PALETTES } from "./palette";

export const radialEqualizerSchema = z.object({
  variant: z.enum(["orangeBlue", "goldMagenta"]),
});

export type RadialEqualizerProps = z.infer<typeof radialEqualizerSchema>;

export const radialEqualizerDefaults: RadialEqualizerProps = {
  variant: "orangeBlue",
};

export const RadialEqualizer: React.FC<RadialEqualizerProps> = ({
  variant,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // useLayoutEffect (not useEffect) so the canvas is fully painted before the
  // browser gets a chance to present the frame for capture.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      return;
    }
    drawFrame(ctx, {
      frame,
      width,
      height,
      duration: durationInFrames,
      palette: PALETTES[variant],
    });
  }, [frame, width, height, durationInFrames, variant]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
