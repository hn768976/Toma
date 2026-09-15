// Scratch composition for tuning the hero look. Not part of the delivered set.

import React from "react";
import { useVideoConfig } from "remotion";
import { Backdrop } from "./layers/Backdrop";
import { Glow } from "./layers/Glow";
import { HeroCircuitry } from "./layers/HeroCircuitry";
import { NeuralCanvas } from "./layers/NeuralCanvas";
import { PALETTES } from "./palette";
import { VersionId } from "./versions";

export type AiTestProps = {
  version: VersionId;
  strength: number;
  threshold: number;
  knee: number;
  spread: number;
  radius: number;
  glow: number;
  fill: number;
  coreHeat: number;
  pulse: number;
  dist: number;
};

export const aiTestDefaults: AiTestProps = {
  version: "V01Halo",
  strength: 1,
  threshold: 0.45,
  knee: 0.25,
  spread: 0.6,
  radius: 1.4,
  glow: 1,
  fill: 0.1,
  coreHeat: 0.06,
  pulse: 0.5,
  dist: 4.4,
};

export const AiTest: React.FC<AiTestProps> = ({
  version,
  strength,
  threshold,
  knee,
  spread,
  radius,
  glow,
  fill,
  coreHeat,
  pulse,
  dist,
}) => {
  const palette = PALETTES[version];
  const { width, height } = useVideoConfig();
  return (
    <NeuralCanvas background="#000000" camera={{ fov: 40, position: [0, 0, dist] }}>
      {(geometry) => (
        <>
          <Backdrop
            inner={palette.backgroundLift}
            outer={palette.background}
            aspect={width / height}
            radius={1.2}
            vignette={0.45}
          />
          <HeroCircuitry
            geometry={geometry}
            palette={palette}
            glow={glow}
            reveal={1}
            pulse={pulse}
            coreHeat={coreHeat}
            fill={fill}
          />
          <Glow
            strength={strength}
            threshold={threshold}
            knee={knee}
            spread={spread}
            radius={radius}
          />
        </>
      )}
    </NeuralCanvas>
  );
};
