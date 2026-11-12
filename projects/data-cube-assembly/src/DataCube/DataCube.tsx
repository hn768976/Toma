import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeStage } from "../lib/ThreeStage";
import { CameraVariant, createDataCubeScene } from "./scene";

export type DataCubeProps = { variant: CameraVariant };

export const DataCube: React.FC<DataCubeProps> = ({ variant }) => {
  const factory = useMemo(() => createDataCubeScene(variant), [variant]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeStage factory={factory} />
    </AbsoluteFill>
  );
};
