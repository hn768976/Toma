import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { StreamRenderer } from "./StreamRenderer";
import { makeCrestShot, makeFoldShot } from "./surfaces";
import { cameraFor } from "./look";

export const lightStreamsSchema = z.object({
  version: z.enum(["reference", "alt-camera"]),
});

type Props = z.infer<typeof lightStreamsSchema>;

/** The reference cuts from the "crest" shot to the "fold" shot at 4.0 s. */
export const CUT_SECONDS = 4.0;

export const LightStreams: React.FC<Props> = ({ version }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StreamRenderer | null>(null);
  const shots = useMemo(() => [makeCrestShot(), makeFoldShot()], []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = new StreamRenderer(canvas, width, height, shots);
    rendererRef.current = r;
    return () => {
      r.dispose();
      rendererRef.current = null;
    };
  }, [width, height, shots]);

  useLayoutEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    const cutFrame = Math.round(CUT_SECONDS * fps);
    const shot = frame < cutFrame ? 0 : 1;
    const start = shot === 0 ? 0 : cutFrame;
    const end = shot === 0 ? cutFrame : durationInFrames;
    const t = (frame - start) / fps;
    const cam = cameraFor(version, shot, t, (end - start) / fps);
    r.render(shot, t, cam, frame);
  }, [frame, fps, durationInFrames, version]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
