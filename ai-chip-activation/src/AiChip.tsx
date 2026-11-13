import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { createScene, SceneHandle } from "./scene/createScene";
import type { CameraPathName } from "./scene/camera";

export type AiChipProps = {
  /** "reference" = Version 1, "orbit" = Version 2 (alternative camera) */
  cameraPath: CameraPathName;
};

// The whole video is a single Three.js (WebGL 2) scene with custom shaders.
// Remotion drives it frame by frame: every frame is a pure function of
// `frame / fps`, rendered synchronously in a layout effect.
export const AiChip: React.FC<AiChipProps> = ({ cameraPath }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = createScene(canvas, width, height, cameraPath);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [width, height, cameraPath]);

  useLayoutEffect(() => {
    sceneRef.current?.render(frame / fps);
  }, [frame, fps, width, height, cameraPath]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#020306" }}>
      <canvas ref={canvasRef} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
