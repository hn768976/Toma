// 07 - Scan visualisation.
//
// The long one: a slow orbit with a scan band travelling up the arch. The
// grid is generated in the shader rather than drawn as real edges -- see
// wireframeMaterial for why -- and the teeth read brighter than the
// alveolar surface so the anatomy stays legible while the fill is nearly
// transparent.

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import { ShaderMaterial } from "three";
import { DentalStage } from "../scene/DentalStage";
import { cameraAt, orbit, ramp } from "../scene/cameraPath";
import { BACKDROPS, macroRig } from "../materials/palette";
import {
  applyWireframeLook,
  createWireframeMaterial,
} from "../materials/wireframeMaterial";
import { useMandible } from "../mesh/useMandible";
import { stageDpr, VersionProps } from "./shared";

export const V07_DURATION = 501;

const RIG = macroRig({ exposure: 1.1 });

const WireArch: React.FC<{ progress: number }> = ({ progress }) => {
  const data = useMandible();
  const camera = useThree((s) => s.camera);
  const material = useMemo(() => createWireframeMaterial(), []);

  // The scan band runs the height of the arch twice over the shot, then
  // parks above it so the model is left clean.
  const scanY = ramp(
    progress,
    [0, 0.3, 0.34, 0.62, 0.68, 1],
    [-0.26, 0.26, -0.26, 0.26, 0.4, 0.4],
  );

  applyWireframeLook(
    material as ShaderMaterial,
    {
      surfaceColor: "#F5FAFE",
      lineColor: "#5795CE",
      toothColor: "#FFFFFF",
      scanColor: "#12C7FF",
      density: 74,
      lineWidth: 1.25,
      lineStrength: ramp(progress, [0, 0.08, 0.92, 1], [0, 0.88, 0.88, 0.6]),
      surfaceOpacity: ramp(progress, [0, 0.12, 0.88, 1], [0.25, 0.86, 0.86, 0.95]),
      fresnel: 0.16,
      scanY,
      scanWidth: 0.055,
    },
    RIG,
    camera.quaternion,
  );

  return <mesh geometry={data.geometry} material={material} frustumCulled={false} />;
};

export const V07WireframeScan: React.FC<VersionProps> = ({
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = frame / (V07_DURATION - 1);

  // One slow pass from the left side, across the front, to the right, with
  // the camera lifting as it goes.
  const camera = cameraAt(p, [
    { at: 0, position: orbit(-96, 1.16, 0.22), target: [0, 0.03, 0.02], fov: 26 },
    { at: 0.3, position: orbit(-42, 1.05, 0.34), target: [0, 0.04, 0.06], fov: 25 },
    { at: 0.55, position: orbit(2, 1.0, 0.44), target: [0, 0.03, 0.05], fov: 25 },
    { at: 0.8, position: orbit(48, 1.06, 0.36), target: [0, 0.04, 0.05], fov: 25 },
    { at: 1, position: orbit(94, 1.18, 0.24), target: [0, 0.03, 0.02], fov: 26 },
  ]);

  return (
    <DentalStage
      width={width}
      height={height}
      backdrop={BACKDROPS.paleMint}
      camera={camera}
      dpr={stageDpr(resolutionScale)}
      vignette={0.18}
      keyGlow={0.24}
    >
      <WireArch progress={p} />
    </DentalStage>
  );
};
