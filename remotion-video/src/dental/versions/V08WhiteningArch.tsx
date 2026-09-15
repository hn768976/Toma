// 08 - Whitening, seen across the whole arch.
//
// The shortest version, and the only one that shows the arch as an object
// rather than a surface: a raised three-quarter view with the camera
// drifting round while a whitening front runs the length of the arch.
// Stain is left at full strength throughout -- the sweep is what removes
// it -- so the before and after states are visible in the same frame.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Arch } from "../scene/Arch";
import { DentalStage } from "../scene/DentalStage";
import { cameraAt, orbit, ramp } from "../scene/cameraPath";
import { look } from "../materials/archMaterial";
import { BACKDROPS, macroRig } from "../materials/palette";
import { SurfaceParticles } from "../fx/SurfaceParticles";
import { stageDpr, VersionProps } from "./shared";

export const V08_DURATION = 150;

const RIG = macroRig({ keyIntensity: 1.15, rimIntensity: 0.52 });

export const V08WhiteningArch: React.FC<VersionProps> = ({
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = frame / (V08_DURATION - 1);

  const camera = cameraAt(p, [
    { at: 0, position: orbit(-40, 1.34, 0.46), target: [0, 0.03, 0.06], fov: 27 },
    { at: 1, position: orbit(10, 1.26, 0.58), target: [0, 0.03, 0.04], fov: 26 },
  ]);

  const sweepPos = ramp(p, [0.08, 0.82], [-1.15, 1.15]);

  const state = look({
    stain: 0.82,
    plaque: 0.3,
    tartar: 0.12,
    wetness: ramp(p, [0.2, 1], [0.32, 0.62]),
    polish: ramp(p, [0.3, 1], [0, 0.95]),
    sweep: [sweepPos, 0.24, 1],
    sweepSign: 1,
    hazeStrength: 0.14,
    hazeNear: 0.8,
    hazeFar: 1.9,
  });

  return (
    <DentalStage
      width={width}
      height={height}
      backdrop={BACKDROPS.studioGrey}
      camera={camera}
      dpr={stageDpr(resolutionScale)}
      vignette={0.26}
      keyGlow={0.32}
      dof={{ range: 0.85, maxBlur: 10, foregroundBlur: 0.3 }}
    >
      <Arch look={state} rig={RIG} timeInSeconds={t} hazeColor="#E4E9ED" />

      {/* A band of glints riding the whitening front. */}
      <SurfaceParticles
        region="teeth"
        count={600}
        seed={801}
        variant="sparkle"
        lifetime={1.1}
        rise={0.045}
        jitter={0.007}
        sizeMin={0.004}
        sizeMax={0.014}
        colorA="#FFFFFF"
        colorB="#CFEEFF"
        glow={1.5}
        opacity={0.9}
        emission={ramp(p, [0.04, 0.14, 0.84, 0.96], [0, 1, 1, 0])}
        timeInSeconds={t}
        sweep={[sweepPos, 0.16, 1]}
      />
    </DentalStage>
  );
};
