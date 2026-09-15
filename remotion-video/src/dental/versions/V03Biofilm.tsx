// 03 - Biofilm and a plant-essence rinse.
//
// The longest of the close shots. It sits almost inside the sulcus: the
// gingiva fills the background, bacteria drift over a plaque-covered neck,
// and the rinse clears both before a fluoride layer seals the enamel.
//
// The three treatment channels are driven off one wavefront so they cannot
// disagree: the same sweep position clears deposits in the arch shader,
// stops bacteria spawning and releases the bubbles.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Arch } from "../scene/Arch";
import { DentalStage } from "../scene/DentalStage";
import { buccal, cameraAt, ramp } from "../scene/cameraPath";
import { look } from "../materials/archMaterial";
import { BACKDROPS, macroRig } from "../materials/palette";
import { SurfaceParticles } from "../fx/SurfaceParticles";
import { stageDpr, VersionProps } from "./shared";

export const V03_DURATION = 301;

const ANGLE = -40;

const RIG = macroRig({
  keyIntensity: 1.06,
  fillColor: "#F3D2CE",
  fillIntensity: 0.4,
  groundColor: "#A04A48",
  groundIntensity: 0.3,
});

export const V03Biofilm: React.FC<VersionProps> = ({ resolutionScale }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = frame / (V03_DURATION - 1);

  const camera = cameraAt(p, [
    { at: 0, position: buccal(ANGLE - 14, 1.28, 0.3), target: buccal(ANGLE - 8, 0.31, 0.06), fov: 22 },
    { at: 0.55, position: buccal(ANGLE + 2, 1.18, 0.26), target: buccal(ANGLE + 6, 0.31, 0.05), fov: 21 },
    { at: 1, position: buccal(ANGLE + 16, 1.32, 0.32), target: buccal(ANGLE + 18, 0.32, 0.06), fov: 22 },
  ]);

  const sweepPos = ramp(p, [0.22, 0.72], [-0.62, 0.34]);
  const dirty = ramp(p, [0.18, 0.78], [1, 0]);

  const state = look({
    stain: 0.55,
    plaque: 0.85,
    tartar: 0.42,
    inflammation: ramp(p, [0.12, 0.72], [0.82, 0.05]),
    inflamCenter: -0.22,
    inflamWidth: 0.6,
    wetness: ramp(p, [0.3, 1], [0.35, 0.72]),
    polish: ramp(p, [0.62, 1], [0, 0.85]),
    shield: ramp(p, [0.74, 0.9, 1], [0, 0.85, 0.62]),
    sweep: [sweepPos, 0.16, 1],
    sweepSign: 1,
    hazeStrength: 0.3,
    hazeNear: 0.38,
    hazeFar: 1.1,
  });

  return (
    <DentalStage
      width={width}
      height={height}
      backdrop={BACKDROPS.tissueRed}
      camera={camera}
      dpr={stageDpr(resolutionScale)}
      vignette={0.4}
      keyGlow={0.22}
      dof={{ range: 0.3, maxBlur: 20, foregroundBlur: 0.5 }}
    >
      <Arch look={state} rig={RIG} timeInSeconds={t} hazeColor="#B4555C" />

      {/* Rod-shaped bacteria clinging to the neck, cleared by the rinse. */}
      <SurfaceParticles
        region="gumline"
        count={520}
        seed={301}
        variant="debris"
        lifetime={4.2}
        rise={0.018}
        swirl={0.01}
        swirlTurns={0.5}
        jitter={0.006}
        sizeMin={0.0028}
        sizeMax={0.0055}
        stretch={[3.6, 0.85, 0.85]}
        colorA="#6C5BC4"
        colorB="#9A5FB8"
        opacity={0.95}
        glow={1}
        emission={dirty}
        timeInSeconds={t}
      />

      {/* The rinse itself. */}
      <SurfaceParticles
        region="teeth"
        count={820}
        seed={302}
        variant="bubble"
        lifetime={1.7}
        rise={0.14}
        swirl={0.026}
        swirlTurns={1.5}
        jitter={0.016}
        sizeMin={0.004}
        sizeMax={0.016}
        colorA="#EAFBF3"
        colorB="#9FE6C8"
        glow={1.45}
        opacity={0.95}
        emission={ramp(p, [0.16, 0.26, 0.76, 0.86], [0, 1, 1, 0])}
        timeInSeconds={t}
        sweep={[sweepPos, 0.22, 1]}
      />
      <SurfaceParticles
        region="crevice"
        count={460}
        seed={303}
        variant="bubble"
        lifetime={1.2}
        rise={0.09}
        swirl={0.018}
        jitter={0.011}
        sizeMin={0.0026}
        sizeMax={0.0085}
        colorA="#FFFFFF"
        colorB="#BFF0DC"
        glow={1.6}
        opacity={0.9}
        emission={ramp(p, [0.16, 0.26, 0.76, 0.86], [0, 1, 1, 0])}
        timeInSeconds={t}
        sweep={[sweepPos, 0.15, 1]}
      />

      {/* A last glint as the fluoride layer sets. */}
      <SurfaceParticles
        region="teeth"
        count={420}
        seed={304}
        variant="sparkle"
        lifetime={1.3}
        rise={0.03}
        jitter={0.006}
        sizeMin={0.004}
        sizeMax={0.013}
        colorA="#BFF6FF"
        colorB="#FFFFFF"
        glow={1.5}
        opacity={0.9}
        emission={ramp(p, [0.76, 0.86, 0.96, 1], [0, 1, 0.8, 0])}
        timeInSeconds={t}
      />
    </DentalStage>
  );
};
