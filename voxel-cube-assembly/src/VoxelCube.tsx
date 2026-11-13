import { useEffect, useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { createVoxelScene, VoxelScene, Variant } from "./scene";

export type VoxelCubeProps = {
  variant: Variant;
};

/**
 * Hosts a Three.js (WebGL 2) scene inside a Remotion composition.
 * Every frame is a pure function of `frame`, so rendering is deterministic
 * and safe to parallelise across browser tabs.
 */
export const VoxelCube: React.FC<VoxelCubeProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<VoxelScene | null>(null);

  useEffect(() => {
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    if (!sceneRef.current) {
      sceneRef.current = createVoxelScene(
        canvasRef.current,
        width,
        height,
        variant,
      );
    }
    sceneRef.current.render(frame / fps);
  }, [frame, fps, width, height, variant]);

  return (
    <AbsoluteFill
      style={{ backgroundColor: variant === "v1" ? "#b9babd" : "#101114" }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, display: "block" }}
      />
      {/* Lens vignette */}
      <AbsoluteFill
        style={{
          background:
            variant === "v1"
              ? "radial-gradient(ellipse 85% 120% at 50% 105%, rgba(0,0,0,0) 62%, rgba(20,22,28,0.1) 100%)"
              : "radial-gradient(ellipse 75% 85% at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
