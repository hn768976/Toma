import React, { useEffect, useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { buildScene, Variant } from "./scene/buildScene";

type SceneHandle = ReturnType<typeof buildScene>;

export const RadarHologram: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);

  useEffect(() => {
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Every frame is a pure function of the frame number, drawn synchronously
  // before Remotion takes its screenshot.
  useLayoutEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    if (!sceneRef.current) {
      sceneRef.current = buildScene(canvasRef.current, width, height, variant);
    }
    sceneRef.current.render(frame);
  }, [frame, width, height, variant]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
