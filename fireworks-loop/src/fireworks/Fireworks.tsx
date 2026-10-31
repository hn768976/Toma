import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { createGlowBuffers, drawFrame } from "./draw";
import { buildShow } from "./show";

export const fireworksSchema = z.object({
  palette: z.enum(["classic", "arctic"]),
});

export type FireworksProps = z.infer<typeof fireworksSchema>;

export const Fireworks: React.FC<FireworksProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const bursts = useMemo(
    () => buildShow(durationInFrames / fps),
    [durationInFrames, fps],
  );
  const glow = useMemo(() => createGlowBuffers(width, height), [width, height]);

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    drawFrame(ctx, glow, bursts, frame / fps, frame, palette);
  }, [frame, fps, bursts, glow, palette]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
