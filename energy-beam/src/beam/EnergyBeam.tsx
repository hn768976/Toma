import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ShaderCanvas } from "../gl/ShaderCanvas";
import { BEAM_FRAGMENT_SHADER } from "./beamShader";
import { BeamPalette } from "./palettes";

/** Pulse period measured from the reference clip (27 frames @ 24 fps). */
export const PULSE_PERIOD_SECONDS = 27 / 24;

export const EnergyBeam: React.FC<{ palette: BeamPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ShaderCanvas
        fragmentShader={BEAM_FRAGMENT_SHADER}
        uniforms={{
          uTime: frame / fps,
          uPeriod: PULSE_PERIOD_SECONDS,
          uTintBeam: palette.tintBeam,
          uTintDeep: palette.tintDeep,
          uTintCore: palette.tintCore,
          uTintFlare: palette.tintFlare,
        }}
      />
    </AbsoluteFill>
  );
};
