import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { ThreeStage } from "../lib/ThreeStage";
import { createTileStage, type CameraMode } from "./scene";

export type TileFlipProps = { camera: CameraMode };

export const TileFlip: React.FC<TileFlipProps> = ({ camera }) => {
  const { durationInFrames, fps } = useVideoConfig();
  const factory = useMemo(
    () => createTileStage(camera, durationInFrames / fps),
    [camera, durationInFrames, fps],
  );
  return <ThreeStage factory={factory} background="#b9b4b0" shadows />;
};
