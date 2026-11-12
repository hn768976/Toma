import React, { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneSpec, Stage } from "./Stage";

/**
 * Hosts a raw three.js WebGL2 renderer inside a Remotion composition.
 * The drawing buffer follows the render scale: the composition is authored
 * at 3840x2160; rendering with --scale=0.5 draws natively at 1920x1080, and
 * --scale=1 draws the full 4K frame. Every frame is a pure function of time.
 */
export const ThreeStage: React.FC<{ create: () => SceneSpec }> = ({ create }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const [initHandle] = useState(() => delayRender("Initialising WebGL stage"));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const pixelRatio = Math.min(dpr, 1);
    const stage = new Stage(canvas, width, height, pixelRatio, create());
    stageRef.current = stage;
    continueRender(initHandle);
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  useLayoutEffect(() => {
    const handle = delayRender(`Rendering frame ${frame}`);
    stageRef.current?.render(frame / fps);
    continueRender(handle);
  }, [frame, fps]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </AbsoluteFill>
  );
};
