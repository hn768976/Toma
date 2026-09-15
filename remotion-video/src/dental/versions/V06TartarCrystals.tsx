// 06 - Calculus lifted by mineral crystals.
//
// The longest macro shot, and the one that leans hardest on the baked
// occlusion: calculus is masked by how occluded a point is, so it forms in
// the interproximal spaces and along the margin exactly where it would
// clinically, and the debris that lifts off spawns from those same points.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Arch } from "../scene/Arch";
import { DentalStage } from "../scene/DentalStage";
import { buccal, cameraAt, ramp } from "../scene/cameraPath";
import { look } from "../materials/archMaterial";
import { BACKDROPS, macroRig } from "../materials/palette";
import { SurfaceParticles } from "../fx/SurfaceParticles";
import { stageDpr, VersionProps } from "./shared";

export const V06_DURATION = 300;

const ANGLE = 44;

const RIG = macroRig({ keyIntensity: 1.12, fillIntensity: 0.38 });

export const V06TartarCrystals: React.FC<VersionProps> = ({
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = frame / (V06_DURATION - 1);

  const camera = cameraAt(p, [
    { at: 0, position: buccal(ANGLE + 14, 1.02, 0.24), target: buccal(ANGLE + 8, 0.31, 0.03), fov: 21 },
    { at: 0.6, position: buccal(ANGLE - 4, 0.94, 0.2), target: buccal(ANGLE - 8, 0.31, 0.02), fov: 20 },
    { at: 1, position: buccal(ANGLE - 18, 1.06, 0.26), target: buccal(ANGLE - 20, 0.32, 0.04), fov: 21 },
  ]);

  // Sweeping right to left, against the arch angle, so sweepSign flips.
  const sweepPos = ramp(p, [0.2, 0.8], [-0.52, 0.3]);
  const sweep: [number, number, number] = [sweepPos, 0.15, 1];

  const state = look({
    stain: 0.5,
    plaque: 0.62,
    tartar: 0.88,
    inflammation: ramp(p, [0.25, 0.85], [0.42, 0.06]),
    inflamCenter: 0.24,
    inflamWidth: 0.7,
    wetness: ramp(p, [0.35, 1], [0.34, 0.66]),
    polish: ramp(p, [0.6, 1], [0, 0.82]),
    sweep,
    sweepSign: -1,
    hazeStrength: 0.26,
    hazeNear: 0.4,
    hazeFar: 1.2,
  });

  const active = ramp(p, [0.14, 0.24, 0.82, 0.92], [0, 1, 1, 0]);

  return (
    <DentalStage
      width={width}
      height={height}
      backdrop={BACKDROPS.softBlue}
      camera={camera}
      dpr={stageDpr(resolutionScale)}
      vignette={0.3}
      keyGlow={0.4}
      dof={{ range: 0.34, maxBlur: 19, foregroundBlur: 0.45 }}
    >
      <Arch look={state} rig={RIG} timeInSeconds={t} hazeColor="#D8E8F5" />

      {/* Mineral crystals arriving at the margin. */}
      <SurfaceParticles
        region="gumline"
        count={300}
        seed={601}
        variant="crystal"
        lifetime={2.1}
        rise={0.1}
        swirl={0.02}
        swirlTurns={0.8}
        jitter={0.012}
        sizeMin={0.007}
        sizeMax={0.019}
        colorA="#B6D6F5"
        colorB="#5E9BD8"
        glow={1.35}
        opacity={0.92}
        emission={active}
        timeInSeconds={t}
        sweep={[sweepPos, 0.2, -1]}
      />

      {/* Loosened calculus, tumbling away opaque and brown. */}
      <SurfaceParticles
        region="crevice"
        count={340}
        seed={602}
        variant="debris"
        lifetime={1.8}
        rise={0.12}
        swirl={0.016}
        swirlTurns={0.6}
        jitter={0.02}
        sizeMin={0.003}
        sizeMax={0.0085}
        colorA="#8A6134"
        colorB="#5E3F1E"
        glow={1}
        emission={active}
        timeInSeconds={t}
        sweep={[sweepPos, 0.16, -1]}
      />

      {/* A thin wash of bubbles carrying the debris off. */}
      <SurfaceParticles
        region="teeth"
        count={480}
        seed={603}
        variant="bubble"
        lifetime={1.6}
        rise={0.12}
        swirl={0.022}
        jitter={0.014}
        sizeMin={0.0028}
        sizeMax={0.0095}
        colorA="#F2FAFF"
        colorB="#AFDCF4"
        glow={1.35}
        opacity={0.85}
        emission={active}
        timeInSeconds={t}
        sweep={[sweepPos, 0.2, -1]}
      />
    </DentalStage>
  );
};
