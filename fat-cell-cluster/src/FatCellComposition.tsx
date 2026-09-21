/**
 * One composition = one look row.
 *
 * The canvas is sized from `useVideoConfig()`, so the same source renders at
 * 1080p for previews and at 4K without touching anything.
 */

import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { getScene } from "./fatcells/build";
import { LookRow } from "./fatcells/looks";
import { Scene } from "./fatcells/Scene";

export const FatCellComposition: React.FC<{ row: LookRow }> = ({ row }) => {
  const { width, height } = useVideoConfig();
  const cameraDistance = getScene(row).cameraDistance;
  return (
    <AbsoluteFill style={{ backgroundColor: row.palette.bgEdge }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: row.camera.fov,
          position: [0, 0, cameraDistance],
          near: 0.1,
          far: 400,
        }}
        gl={{
          antialias: true,
          // ACES, and sRGB out. Leaving the renderer linear clips the high-key
          // composition; leaving it untonemapped flattens the warm mid-tones.
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: "high-performance",
        }}
        dpr={1}
        flat={false}
      >
        <Scene row={row} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
