// Canvas wrapper shared by all nine versions.
//
// Two things matter here. First, the GLB has to be parsed *before* the WebGL
// canvas mounts: @remotion/three runs the renderer with frameloop="demand", so
// a mesh that arrives asynchronously after the frame has been drawn never
// triggers a redraw and silently renders nothing. Gating the canvas on the
// loaded geometry sidesteps that entirely.
//
// Second, geometry is handed down through a render prop rather than a React
// context, because @react-three/fiber renders children with its own reconciler
// and application contexts from outside the canvas do not reliably cross it.

import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useNeuralGeometry } from "../useGlb";
import { ColorPipeline } from "./ColorPipeline";

export type NeuralCanvasProps = {
  /** Page colour behind the canvas; also what the canvas clears to. */
  background: string;
  camera?: {
    fov?: number;
    position?: [number, number, number];
    near?: number;
    far?: number;
  };
  /** Receives the parsed hero geometry once it is ready. */
  children: (geometry: THREE.BufferGeometry) => React.ReactNode;
  /** Optional DOM layers drawn over the canvas (vignettes, grain, glow). */
  overlay?: React.ReactNode;
};

export const NeuralCanvas: React.FC<NeuralCanvasProps> = ({
  background,
  camera,
  children,
  overlay,
}) => {
  const { width, height } = useVideoConfig();
  const geometry = useNeuralGeometry();

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      {geometry ? (
        <ThreeCanvas
          width={width}
          height={height}
          camera={{
            fov: camera?.fov ?? 40,
            position: camera?.position ?? [0, 0, 4.4],
            near: camera?.near ?? 0.1,
            far: camera?.far ?? 200,
          }}
          gl={{ antialias: true, alpha: true }}
          style={{ position: "absolute", inset: 0 }}
        >
          <ColorPipeline />
          {children(geometry)}
        </ThreeCanvas>
      ) : null}
      {overlay}
    </AbsoluteFill>
  );
};
