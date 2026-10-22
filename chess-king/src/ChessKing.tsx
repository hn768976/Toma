import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import * as THREE from "three";
import { z } from "zod";
import { PALETTES } from "./palettes";
import { World } from "./World";

export const chessKingSchema = z.object({
  palette: z.enum(["goldNoir", "platinumCrimson"]),
});

export const ChessKing: React.FC<z.infer<typeof chessKingSchema>> = ({ palette }) => {
  const { width, height } = useVideoConfig();
  const pal = PALETTES[palette];
  return (
    <AbsoluteFill style={{ backgroundColor: pal.backdropBottom }}>
      <ThreeCanvas
        width={width}
        height={height}
        // Render at the output resolution (scaled renders downsample the 4K stage).
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio}
        shadows="soft"
        camera={{ fov: 30, near: 0.1, far: 120, position: [0, 1, 8] }}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      >
        <World palette={pal} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
