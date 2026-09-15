// 09 - Enamel polish.
//
// Closes the set on the darkest backdrop, which is what lets the sparkle
// read: a macro on the front teeth, a burst of glints travelling across
// them, and enamel that ends fully polished and wet. Roughness drops and
// the environment term takes over, so the highlight broadens rather than
// simply brightening.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Arch } from "../scene/Arch";
import { DentalStage } from "../scene/DentalStage";
import { buccal, cameraAt, ramp } from "../scene/cameraPath";
import { look } from "../materials/archMaterial";
import { BACKDROPS, macroRig } from "../materials/palette";
import { SurfaceParticles } from "../fx/SurfaceParticles";
import { stageDpr, VersionProps } from "./shared";

export const V09_DURATION = 200;

const RIG = macroRig({
  keyIntensity: 1.2,
  fillColor: "#BFE4F2",
  fillIntensity: 0.4,
  rimColor: "#DFF4FF",
  rimIntensity: 0.58,
  skyColor: "#BCDCEA",
  skyIntensity: 0.34,
  groundColor: "#2E5A6E",
  groundIntensity: 0.22,
});

export const V09EnamelSparkle: React.FC<VersionProps> = ({
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = frame / (V09_DURATION - 1);

  const camera = cameraAt(p, [
    { at: 0, position: buccal(-18, 1.3, 0.3), target: buccal(-12, 0.3, 0.08), fov: 22 },
    { at: 1, position: buccal(10, 1.22, 0.26), target: buccal(12, 0.3, 0.07), fov: 21 },
  ]);

  const sweepPos = ramp(p, [0.14, 0.76], [-0.62, 0.52]);

  const state = look({
    stain: 0.44,
    plaque: 0.26,
    wetness: ramp(p, [0.1, 1], [0.38, 0.85]),
    polish: ramp(p, [0.24, 0.92], [0, 1]),
    sweep: [sweepPos, 0.18, 1],
    sweepSign: 1,
    hazeStrength: 0.26,
    hazeNear: 0.6,
    hazeFar: 1.5,
  });

  const burst = ramp(p, [0.08, 0.2, 0.8, 0.94], [0, 1, 1, 0]);

  return (
    <DentalStage
      width={width}
      height={height}
      backdrop={BACKDROPS.deepTeal}
      camera={camera}
      dpr={stageDpr(resolutionScale)}
      vignette={0.42}
      keyGlow={0.3}
      dof={{ range: 0.5, maxBlur: 16, foregroundBlur: 0.4 }}
    >
      <Arch look={state} rig={RIG} timeInSeconds={t} hazeColor="#4E88A4" />

      <SurfaceParticles
        region="teeth"
        count={1100}
        seed={901}
        variant="sparkle"
        lifetime={1.2}
        rise={0.07}
        swirl={0.012}
        jitter={0.012}
        sizeMin={0.008}
        sizeMax={0.032}
        colorA="#5FD8FF"
        colorB="#BFF2FF"
        glow={2.2}
        opacity={0.95}
        emission={burst}
        timeInSeconds={t}
        sweep={[sweepPos, 0.2, 1]}
      />
      <SurfaceParticles
        region="crevice"
        count={380}
        seed={902}
        variant="sparkle"
        lifetime={0.9}
        rise={0.04}
        jitter={0.008}
        sizeMin={0.005}
        sizeMax={0.017}
        colorA="#8FE7FF"
        colorB="#FFFFFF"
        glow={2.0}
        opacity={0.85}
        emission={burst}
        timeInSeconds={t}
        sweep={[sweepPos, 0.15, 1]}
      />
    </DentalStage>
  );
};
