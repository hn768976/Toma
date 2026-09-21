// Composition entry point. Wraps the rig in a Remotion-driven three canvas.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { VirusField, CAMERA_Z, CAMERA_FOV } from "./VirusField";
import type { LookSpec } from "./data/types";
import { LOOP_FRAMES } from "./loop";

/**
 * Remotion's `--scale` works by setting the browser's device pixel ratio, but
 * react-three-fiber clamps `dpr` to [1, 2] by default — so a 4K composition
 * rendered at `--scale=0.5` still drew a 3840x2160 buffer and threw three
 * quarters of it away. Passing the real ratio through makes the GL work match
 * the output size, which is a 4x saving on every 1080p preview frame.
 */
const useRenderDpr = (): number => {
  const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return ratio > 0 ? ratio : 1;
};

export const VirusScene: React.FC<{ look: LookSpec }> = ({ look }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const dpr = useRenderDpr();

  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      // The camera is fixed for the whole clip. All the motion is in the field.
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV, near: 0.1, far: 120 }}
      gl={{
        antialias: true,
        // The composer owns tonemapping; leaving it on here would apply twice.
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      linear={false}
      flat
    >
      <VirusField look={look} frame={frame} loopFrames={LOOP_FRAMES} />
    </ThreeCanvas>
  );
};
