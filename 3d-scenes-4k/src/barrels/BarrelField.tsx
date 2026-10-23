import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { ThreeStage } from "../lib/ThreeStage";
import { createBarrelSetup, type BarrelVariant } from "./scene";

export const BarrelField: React.FC<{ variant: BarrelVariant }> = ({ variant }) => {
  const { durationInFrames } = useVideoConfig();
  const setup = useMemo(
    () => createBarrelSetup(variant, durationInFrames),
    [variant, durationInFrames],
  );
  return <ThreeStage setup={setup} />;
};
