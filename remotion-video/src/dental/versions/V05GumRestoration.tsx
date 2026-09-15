// 05 - Restoring inflamed, receded gingiva.
//
// The mirror of version 04, and deliberately built from the same state
// struct run backwards: the tissue starts where version 04 leaves it, a
// treatment wavefront passes, and inflammation, swelling and recession all
// resolve. Sharing the model is what keeps the before and after pair
// looking like the same patient.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Arch } from "../scene/Arch";
import { DentalStage } from "../scene/DentalStage";
import { cameraAt, ramp } from "../scene/cameraPath";
import { look } from "../materials/archMaterial";
import { BACKDROPS, macroRig } from "../materials/palette";
import { SurfaceParticles } from "../fx/SurfaceParticles";
import { stageDpr, VersionProps } from "./shared";

export const V05_DURATION = 201;

const RIG = macroRig({ keyIntensity: 1.12, rimIntensity: 0.5 });

export const V05GumRestoration: React.FC<VersionProps> = ({
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = frame / (V05_DURATION - 1);

  const camera = cameraAt(p, [
    { at: 0, position: [-0.05, 0.1, 0.96], target: [0, 0.08, 0.2], fov: 24 },
    { at: 1, position: [0.05, 0.12, 1.05], target: [0, 0.085, 0.2], fov: 25 },
  ]);

  // The treatment front runs left to right across the front of the arch.
  const sweepPos = ramp(p, [0.12, 0.78], [-0.72, 0.72]);
  const healed = ramp(p, [0.14, 0.86], [1, 0]);

  const state = look({
    plaque: 0.5 * healed,
    tartar: 0.28 * healed,
    stain: 0.28 * healed,
    inflammation: 0.9 * healed,
    inflamCenter: -0.02,
    inflamWidth: 0.85,
    swell: 0.01 * healed,
    swellCenter: -0.02,
    swellWidth: 0.7,
    gumLine: ramp(p, [0.2, 0.92], [-0.05, 0]),
    wetness: ramp(p, [0.3, 1], [0.4, 0.6]),
    polish: ramp(p, [0.55, 1], [0, 0.6]),
    sweep: [sweepPos, 0.2, 1],
    sweepSign: 1,
    hazeStrength: 0.34,
    hazeNear: 0.78,
    hazeFar: 1.45,
  });

  const emission = ramp(p, [0.06, 0.16, 0.82, 0.94], [0, 1, 1, 0]);

  return (
    <DentalStage
      width={width}
      height={height}
      backdrop={BACKDROPS.clinicalWhite}
      camera={camera}
      dpr={stageDpr(resolutionScale)}
      vignette={0.22}
      keyGlow={0.36}
      dof={{ range: 0.75, maxBlur: 11, foregroundBlur: 0.3 }}
    >
      <Arch
        look={state}
        rig={RIG}
        timeInSeconds={t}
        hazeColor="#EDF3F8"
        maxilla
        maxillaGap={0.012}
      />

      {/* Treatment bubbles, held at the margin where the tissue is healing. */}
      <SurfaceParticles
        region="gumline"
        count={720}
        seed={501}
        variant="bubble"
        lifetime={1.9}
        rise={0.13}
        swirl={0.03}
        swirlTurns={1.2}
        jitter={0.015}
        sizeMin={0.0045}
        sizeMax={0.017}
        colorA="#D9F7FF"
        colorB="#63D6F5"
        glow={1.7}
        opacity={0.95}
        emission={emission}
        timeInSeconds={t}
        sweep={[sweepPos, 0.26, 1]}
      />
      <SurfaceParticles
        region="gum"
        count={360}
        seed={502}
        variant="sparkle"
        lifetime={1.5}
        rise={0.05}
        jitter={0.008}
        sizeMin={0.005}
        sizeMax={0.016}
        colorA="#8FE8FF"
        colorB="#FFFFFF"
        glow={1.35}
        opacity={0.8}
        emission={emission}
        timeInSeconds={t}
        sweep={[sweepPos, 0.22, 1]}
      />
    </DentalStage>
  );
};
