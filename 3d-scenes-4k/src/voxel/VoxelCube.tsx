import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { ThreeStage } from "../lib/ThreeStage";
import { createVoxelSetup, type VoxelVariant } from "./scene";

export const VoxelCube: React.FC<{ variant: VoxelVariant }> = ({ variant }) => {
  const { durationInFrames, fps } = useVideoConfig();
  const setup = useMemo(
    () => createVoxelSetup(variant, durationInFrames, fps),
    [variant, durationInFrames, fps],
  );
  return <ThreeStage setup={setup} />;
};
