import { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { DnaScene } from "./DnaScene";
import { Variant } from "./timeline";

export type DnaHelixProps = {
  variant: Variant;
};

/**
 * Remotion wrapper around the imperative Three.js scene. The WebGL canvas is
 * always rendered at the composition's native size (3840×2160); rendering with
 * `--scale=0.5` supersamples it down to 1920×1080.
 */
export const DnaHelix: React.FC<DnaHelixProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<DnaScene | null>(null);
  const [handle] = useState(() => delayRender("Initialising Three.js DNA scene"));

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const scene = new DnaScene(canvasRef.current, width, height, variant);
    sceneRef.current = scene;
    continueRender(handle);
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [width, height, variant, handle]);

  useLayoutEffect(() => {
    sceneRef.current?.render(frame);
  }, [frame, width, height, variant]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#01040f" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
