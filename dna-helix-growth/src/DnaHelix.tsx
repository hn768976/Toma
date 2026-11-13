import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { GLCanvas } from "./gl/GLCanvas";
import { createDnaScene, DEFAULT_CAMERA } from "./dna/dnaScene";
import { PALETTES, type PaletteName } from "./dna/palettes";

export type DnaHelixProps = {
  palette: PaletteName;
};

export const DnaHelix: React.FC<DnaHelixProps> = ({ palette }) => {
  const { durationInFrames } = useVideoConfig();
  const factory = useMemo(
    () => createDnaScene(PALETTES[palette], DEFAULT_CAMERA, durationInFrames),
    [palette, durationInFrames],
  );
  return <GLCanvas factory={factory} />;
};
