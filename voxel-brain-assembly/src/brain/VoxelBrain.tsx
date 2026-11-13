import { useEffect, useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { CameraVariant } from "./camera";
import { BrainWorld } from "./world";

export type VoxelBrainProps = {
  variant: CameraVariant;
};

/**
 * Remotion component hosting the Three.js world. The WebGL canvas is
 * allocated at full composition resolution (3840x2160 for 4K) and the scene
 * is re-rendered synchronously for every frame.
 */
export const VoxelBrain: React.FC<VoxelBrainProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<BrainWorld | null>(null);

  useEffect(() => {
    return () => {
      worldRef.current?.dispose();
      worldRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!worldRef.current) {
      worldRef.current = new BrainWorld(canvas, width, height, variant);
    }
    worldRef.current.render(frame / fps, durationInFrames / fps);
  }, [frame, fps, durationInFrames, width, height, variant]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#eefafb" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
