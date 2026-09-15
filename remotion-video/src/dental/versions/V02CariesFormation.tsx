// 02 - Formation of a carious lesion.
//
// Opens on the arch, pushes in on one molar, and lets the lesion develop:
// a chalky white-spot stage first, then cavitation. The camera target is
// read off the mesh rather than typed in, so the shot stays framed on the
// tooth the lesion is actually carved into.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Arch } from "../scene/Arch";
import { DentalStage } from "../scene/DentalStage";
import { buccal, cameraAt, ramp, Vec3 } from "../scene/cameraPath";
import { look } from "../materials/archMaterial";
import { BACKDROPS, macroRig } from "../materials/palette";
import { useMandible } from "../mesh/useMandible";
import { toothAnchor } from "../mesh/anchors";
import { stageDpr, VersionProps } from "./shared";

export const V02_DURATION = 211;

// Island 4 is the first molar on the subject's left, sitting at -67 deg
// around the arch (the bake prints every island's angle). The camera angle
// below is matched to it so the push-in lands square on the lesion.
const TARGET_TOOTH = 4;
const TARGET_ANGLE = -67;

const RIG = macroRig({ keyIntensity: 1.1, fillIntensity: 0.38 });

const Scene: React.FC<{ progress: number; time: number }> = ({
  progress,
  time,
}) => {
  const data = useMandible();
  const anchor = toothAnchor(data.geometry, TARGET_TOOTH);

  // Seat the lesion a little below the cusp tip, in the central fossa
  // where occlusal caries actually starts.
  const centre: Vec3 = [
    anchor.position[0] - anchor.normal[0] * 0.012,
    anchor.position[1] - 0.012,
    anchor.position[2] - anchor.normal[2] * 0.012,
  ];

  const state = look({
    stain: ramp(progress, [0.15, 0.7], [0.08, 0.3]),
    plaque: ramp(progress, [0.1, 0.55], [0.05, 0.42]),
    wetness: 0.4,
    cavity: ramp(progress, [0.3, 0.86], [0, 1]),
    cavityCenter: centre,
    cavityRadius: 0.032,
    cavityDepth: 0.03,
    hazeStrength: 0.18,
    hazeNear: 0.8,
    hazeFar: 2.2,
  });

  return <Arch look={state} rig={RIG} timeInSeconds={time} hazeColor="#CFE4F5" />;
};

export const V02CariesFormation: React.FC<VersionProps> = ({
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = frame / (V02_DURATION - 1);

  const camera = cameraAt(p, [
    { at: 0, position: buccal(-46, 1.9, 1.15), target: [0, 0.04, 0.05], fov: 26 },
    {
      at: 0.5,
      position: buccal(TARGET_ANGLE - 6, 1.16, 0.72),
      target: buccal(TARGET_ANGLE, 0.28, 0.16),
      fov: 24,
    },
    {
      at: 1,
      position: buccal(TARGET_ANGLE - 3, 0.78, 0.55),
      target: buccal(TARGET_ANGLE, 0.28, 0.16),
      fov: 23,
    },
  ]);

  return (
    <DentalStage
      width={width}
      height={height}
      backdrop={BACKDROPS.medicalBlue}
      camera={camera}
      dpr={stageDpr(resolutionScale)}
      vignette={0.24}
      keyGlow={0.3}
      dof={{ range: 0.62, maxBlur: 13, foregroundBlur: 0.35 }}
    >
      <Scene progress={p} time={t} />
    </DentalStage>
  );
};
