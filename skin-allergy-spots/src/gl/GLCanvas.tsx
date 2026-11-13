import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type GLScene = {
  /** Draw the given frame. Must be a pure function of `frame`. */
  render: (frame: number) => void;
  dispose: () => void;
};

export type GLSceneFactory = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  fps: number,
) => GLScene;

/**
 * Hosts a WebGL scene inside a Remotion composition. The scene is created once
 * and re-drawn synchronously for every frame, so each frame is deterministic
 * and can be rendered in any order / in parallel tabs.
 */
export const GLCanvas: React.FC<{ factory: GLSceneFactory }> = ({
  factory,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<GLScene | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = factory(canvas, width, height, fps);
    sceneRef.current = scene;
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
  }, [factory, width, height, fps]);

  useLayoutEffect(() => {
    sceneRef.current?.render(frame);
  }, [frame, factory, width, height, fps]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
