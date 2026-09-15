// 01 - Plaque removal by cleaning bubbles.
//
// A macro tracking shot along the buccal surfaces. Stain and plaque are
// held constant; what moves is the cleaning wavefront, which both wipes
// the deposits out of the shader and gates where bubbles are emitted, so
// the two always agree about which teeth have been reached.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Arch } from "../scene/Arch";
import { DentalStage } from "../scene/DentalStage";
import { buccal, cameraAt, ramp } from "../scene/cameraPath";
import { look } from "../materials/archMaterial";
import { BACKDROPS, macroRig, TISSUE } from "../materials/palette";
import { SurfaceParticles } from "../fx/SurfaceParticles";
import { stageDpr, VersionProps } from "./shared";

export const V01_DURATION = 201;

const RIG = macroRig({ keyIntensity: 1.18, rimIntensity: 0.5 });

export const V01PlaqueClean: React.FC<VersionProps> = ({ resolutionScale }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = frame / (V01_DURATION - 1);

  const camera = cameraAt(p, [
    { at: 0, position: buccal(-74, 1.5, 0.42), target: buccal(-66, 0.34, 0.06), fov: 22 },
    { at: 1, position: buccal(-16, 1.42, 0.36), target: buccal(-10, 0.32, 0.05), fov: 21 },
  ]);

  // The wavefront leads the camera slightly, so a tooth is already
  // clearing as it arrives at the centre of frame.
  const sweepPos = ramp(p, [0.06, 0.88], [-0.78, 0.42]);
  const sweep: [number, number, number] = [sweepPos, 0.17, 1];

  const state = look({
    stain: 0.68,
    plaque: 0.5,
    tartar: 0.32,
    wetness: ramp(p, [0, 1], [0.3, 0.62]),
    polish: ramp(p, [0.34, 1], [0, 0.8]),
    sweep,
    sweepSign: 1,
    hazeStrength: 0.22,
    hazeNear: 0.55,
    hazeFar: 1.5,
  });

  const emission = ramp(p, [0.02, 0.12, 0.86, 0.97], [0, 1, 1, 0]);

  return (
    <DentalStage
      width={width}
      height={height}
      backdrop={BACKDROPS.softBlue}
      camera={camera}
      dpr={stageDpr(resolutionScale)}
      vignette={0.3}
      keyGlow={0.4}
      dof={{ range: 0.5, maxBlur: 16, foregroundBlur: 0.4 }}
    >
      <Arch look={state} rig={RIG} timeInSeconds={t} hazeColor="#DCEAF6" />
      <SurfaceParticles
        region="teeth"
        count={760}
        seed={101}
        variant="bubble"
        lifetime={1.5}
        rise={0.11}
        swirl={0.022}
        swirlTurns={1.3}
        jitter={0.014}
        sizeMin={0.004}
        sizeMax={0.015}
        colorA="#EAF7FF"
        colorB="#A9DDF6"
        glow={1.4}
        opacity={0.95}
        emission={emission}
        timeInSeconds={t}
        sweep={[sweepPos, 0.2, 1]}
      />
      <SurfaceParticles
        region="crevice"
        count={420}
        seed={102}
        variant="bubble"
        lifetime={1.1}
        rise={0.075}
        swirl={0.016}
        jitter={0.01}
        sizeMin={0.0028}
        sizeMax={0.009}
        colorA="#FFFFFF"
        colorB={TISSUE.shield}
        glow={1.5}
        opacity={0.9}
        emission={emission}
        timeInSeconds={t}
        sweep={[sweepPos, 0.14, 1]}
      />
    </DentalStage>
  );
};
