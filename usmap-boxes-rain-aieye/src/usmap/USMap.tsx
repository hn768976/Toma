import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeStage } from "../lib/ThreeStage";
import { createMapPipeline, MapPalette } from "./mapPipeline";

export const USMap: React.FC<{ palette: MapPalette }> = ({ palette }) => {
  const factory = useMemo(() => createMapPipeline(palette), [palette]);
  return (
    <AbsoluteFill style={{ backgroundColor: palette.bgEdge }}>
      <ThreeStage factory={factory} />
    </AbsoluteFill>
  );
};
