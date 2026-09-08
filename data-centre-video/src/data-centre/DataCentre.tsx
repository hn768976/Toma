/**
 * "Isometric Data Centre Build".
 *
 * Server racks assembling row by row in a true isometric projection, with
 * cable runs, status LEDs and a slow reveal of a complete facility. Builds
 * and holds — this is not a loop.
 */

import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Scene } from "./Scene";
import { Overlays } from "./Overlays";
import { THEMES, type ThemeId } from "./theme";

export type DataCentreProps = {
  theme: ThemeId;
  seed: number;
};

export const dataCentreDefaults: DataCentreProps = {
  theme: "dark",
  seed: 20260908,
};

export const DataCentre: React.FC<DataCentreProps> = ({ theme, seed }) => {
  const { width, height } = useVideoConfig();
  const resolved = THEMES[theme];

  return (
    <AbsoluteFill style={{ backgroundColor: resolved.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        orthographic
        shadows="percentage"
        flat
        dpr={1}
        gl={{ antialias: true }}
      >
        <Scene theme={resolved} seed={seed} />
      </ThreeCanvas>
      <Overlays theme={resolved} />
    </AbsoluteFill>
  );
};
