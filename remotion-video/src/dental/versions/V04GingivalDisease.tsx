// 04 - Progression of gingival disease.
//
// A near-locked front view, so the only thing moving is the tissue. The
// sequence follows the clinical one: deposits accumulate at the margin,
// the gingiva inflames and swells, then attachment is lost and the margin
// retreats to expose root.
//
// The recession is real, not a cross-fade. Each vertex knows its signed
// height above the original margin, so driving `gumLine` negative moves
// the enamel/gingiva boundary down the tooth and uncovers cementum that
// was always modelled underneath.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Arch } from "../scene/Arch";
import { DentalStage } from "../scene/DentalStage";
import { cameraAt, ramp } from "../scene/cameraPath";
import { look } from "../materials/archMaterial";
import { BACKDROPS, macroRig } from "../materials/palette";
import { stageDpr, VersionProps } from "./shared";

export const V04_DURATION = 201;

const RIG = macroRig({ keyIntensity: 1.1, rimIntensity: 0.46 });

export const V04GingivalDisease: React.FC<VersionProps> = ({
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = frame / (V04_DURATION - 1);

  const camera = cameraAt(p, [
    { at: 0, position: [0.04, 0.115, 1.06], target: [0, 0.085, 0.2], fov: 25 },
    { at: 1, position: [-0.03, 0.095, 0.94], target: [0, 0.08, 0.2], fov: 24 },
  ]);

  const state = look({
    // Deposits arrive first, then the tissue reacts to them.
    plaque: ramp(p, [0.05, 0.45], [0.05, 0.5]),
    tartar: ramp(p, [0.18, 0.62], [0, 0.3]),
    stain: ramp(p, [0.1, 0.7], [0.05, 0.3]),
    inflammation: ramp(p, [0.12, 0.58], [0, 0.92]),
    inflamCenter: -0.05,
    inflamWidth: 0.85,
    swell: ramp(p, [0.16, 0.5, 0.86], [0, 0.011, 0.006]),
    swellCenter: -0.05,
    swellWidth: 0.7,
    // Attachment loss comes last and keeps going as the shot ends.
    gumLine: ramp(p, [0.52, 1], [0, -0.05]),
    wetness: ramp(p, [0.2, 0.7], [0.32, 0.55]),
    hazeStrength: 0.34,
    hazeNear: 0.78,
    hazeFar: 1.45,
  });

  return (
    <DentalStage
      width={width}
      height={height}
      backdrop={BACKDROPS.clinicalWhite}
      camera={camera}
      dpr={stageDpr(resolutionScale)}
      vignette={0.22}
      keyGlow={0.34}
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
    </DentalStage>
  );
};
