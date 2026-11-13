import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { GLCanvas } from "./gl/GLCanvas";
import { createSkinScene, ORBIT_CAMERA, REFERENCE_CAMERA } from "./skin/skinScene";

const CAMERAS = { reference: REFERENCE_CAMERA, orbit: ORBIT_CAMERA } as const;

export type SkinSpotsProps = {
  camera: keyof typeof CAMERAS;
};

export const SkinSpots: React.FC<SkinSpotsProps> = ({ camera }) => {
  const { durationInFrames } = useVideoConfig();
  const factory = useMemo(
    () => createSkinScene(CAMERAS[camera], durationInFrames),
    [camera, durationInFrames],
  );
  return <GLCanvas factory={factory} />;
};
