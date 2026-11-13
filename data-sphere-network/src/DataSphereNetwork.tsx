import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { cameraV1, cameraV2 } from "./scene/cameraPaths";
import { renderFrame } from "./scene/render";
import { buildWorld } from "./scene/world";

export type DataSphereNetworkProps = {
  /** "dolly" = reference camera move, "corkscrew" = alternative camera move. */
  camera: "dolly" | "corkscrew";
};

/**
 * Canvas 2D renderer driven by a small custom 3D engine (perspective camera,
 * motion-blur streaks, depth of field, additive light). Every frame is a pure
 * function of the frame number, so renders are deterministic and can be split
 * across any number of parallel workers.
 */
export const DataSphereNetwork: React.FC<DataSphereNetworkProps> = ({ camera }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useMemo(() => buildWorld(7), []);
  const path = camera === "dolly" ? cameraV1 : cameraV2;

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d", { alpha: false });
    if (!ctx) return;
    renderFrame(ctx, world, path, frame / fps, width, height);
  }, [frame, fps, width, height, world, path]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#01030a" }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
