import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { z } from "zod";
import { MolecularScene } from "./MolecularScene";
import { FilmGrain } from "./FilmGrain";
import { PRESET_BY_ID, VERSION_IDS } from "./presets";
import { useMoleculeGeometry } from "./useMoleculeGeometry";
import { BASE_WIDTH } from "./constants";

export const molecularVersionSchema = z.object({
  versionId: z.enum(VERSION_IDS),
});

export type MolecularVersionProps = z.infer<typeof molecularVersionSchema>;

export const MolecularVersion: React.FC<MolecularVersionProps> = ({ versionId }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const preset = PRESET_BY_ID[versionId];
  const geometry = useMoleculeGeometry();

  if (!preset) {
    throw new Error(`Unknown version id: ${versionId}`);
  }

  const time = frame / fps;
  // 1 at 1080p, 2 at 4K. Only screen-space effects need to know.
  const resolutionScale = width / BASE_WIDTH;

  // The canvas is held back until the GLB is in memory. <ThreeCanvas /> only
  // re-renders three on a *frame* change, so a mesh that appears later in the
  // same frame would never be drawn — mounting the canvas complete avoids
  // having to force an extra advance.
  if (!geometry) {
    return <AbsoluteFill style={{ backgroundColor: preset.background.bottom }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: preset.background.bottom }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: preset.camera(0).fov, position: preset.camera(0).position }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <MolecularScene
          preset={preset}
          time={time}
          resolutionScale={resolutionScale}
          geometry={geometry}
        />
      </ThreeCanvas>

      <FilmGrain frame={frame} opacity={preset.post.grain} />
    </AbsoluteFill>
  );
};
