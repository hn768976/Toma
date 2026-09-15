import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { DentalStage } from "./scene/DentalStage";
import { Arch } from "./scene/Arch";
import { look } from "./materials/archMaterial";
import { BACKDROPS, CLINICAL_RIG } from "./materials/palette";

// Four framings on one timeline so a single strip of stills covers the
// whole look: wide arch, front occlusion, macro gum line, and top-down.
const SHOTS: { pos: [number, number, number]; target: [number, number, number]; fov: number }[] = [
  { pos: [0, 0.42, 1.05], target: [0, 0.02, 0], fov: 32 },
  { pos: [0, 0.2, 0.92], target: [0, 0.14, 0.05], fov: 26 },
  { pos: [0.34, 0.28, 0.58], target: [0.12, 0.1, 0.3], fov: 24 },
  { pos: [0, 1.3, 0.02], target: [0, 0, 0], fov: 30 },
];

export const SmokeTest: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const shot = SHOTS[Math.min(Math.floor(frame / 10), SHOTS.length - 1)];
  return (
    <DentalStage
      width={width}
      height={height}
      backdrop={BACKDROPS.softBlue}
      camera={{ position: shot.pos, target: shot.target, fov: shot.fov }}
    >
      <Arch
        look={look({ wetness: 0.3 })}
        rig={CLINICAL_RIG}
        timeInSeconds={t}
        maxilla
        maxillaGap={-0.03}
      />
    </DentalStage>
  );
};
