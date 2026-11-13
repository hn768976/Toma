import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { createScene, SceneHandle } from "./scene/createScene";
import { duskPalette, referencePalette } from "./scene/palette";

export type BotNetworkProps = {
  /** "reference" = Version 1, "dusk" = Version 2 (alternative palette) */
  palette: "reference" | "dusk";
};

// The whole video is a single Three.js (WebGL 2) scene. Remotion drives it
// frame by frame: every frame is a pure function of `frame / fps`, rendered
// synchronously in a layout effect so the screenshot always sees it.
export const BotNetwork: React.FC<BotNetworkProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = createScene(
      canvas,
      width,
      height,
      palette === "dusk" ? duskPalette : referencePalette,
    );
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [width, height, palette]);

  useLayoutEffect(() => {
    sceneRef.current?.render(frame / fps);
  }, [frame, fps, width, height, palette]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#01020a" }}>
      <canvas ref={canvasRef} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
