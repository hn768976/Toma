import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders/magma";
import { FIELD } from "./constants";
import { hexToRgb, type Palette } from "./palettes";

const Field: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Everything time-varying comes from this one normalised value. Remotion
  // renders frames out of order across threads, so a wall clock or a useFrame
  // delta would desynchronise them; frame / durationInFrames cannot.
  const t = frame / durationInFrames;

  const uniforms = useMemo(
    () => ({
      uResolution: { value: new THREE.Vector2(width, height) },
      uT: { value: 0 },
      uDuration: { value: durationInFrames },
      uPal: { value: palette.stops.map((s) => new THREE.Vector3(...hexToRgb(s))) },
      uCells: { value: FIELD.cells },
      uWarpAmp1: { value: FIELD.warpAmp1 },
      uWarpFreq1: { value: FIELD.warpFreq1 },
      uWarpRate1: { value: FIELD.warpRate1 },
      uWarpAmp2: { value: FIELD.warpAmp2 },
      uWarpFreq2: { value: FIELD.warpFreq2 },
      uWarpRate2: { value: FIELD.warpRate2 },
      uJitter: { value: FIELD.jitter },
      uCellCycles: { value: FIELD.cellCycles },
      uCells2: { value: FIELD.cells2 },
      uCellCycles2: { value: FIELD.cellCycles2 },
      uFiligree: { value: FIELD.filigree },
      uPlateMin: { value: FIELD.plateMin },
      uPlateVar: { value: FIELD.plateVar },
      uSpeck: { value: FIELD.speck },
      uHeatGamma: { value: palette.heatGamma },
      uVeinW: { value: FIELD.veinW },
      uContourN: { value: FIELD.contourN },
      uBloom: { value: FIELD.bloom },
      uPulse: { value: FIELD.pulse },
      uPulseCycles: { value: FIELD.pulseCycles },
      uGrain: { value: FIELD.grain },
      uCrust: { value: FIELD.crust },
    }),
    [width, height, durationInFrames, palette],
  );

  // Written before the renderer reads them, so each frame draws from its own
  // frame number and nothing carries over between frames.
  uniforms.uT.value = t;
  uniforms.uResolution.value.set(width, height);

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

export const MagmaField: React.FC<{ palette: Palette }> = ({ palette }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <ThreeCanvas width={width} height={height} gl={{ antialias: false }}>
        <Field palette={palette} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
