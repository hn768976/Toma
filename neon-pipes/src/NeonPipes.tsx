import React, { useMemo } from "react";
import { ThreeStage } from "./ThreeStage";
import { emberTealPalette, referencePalette } from "./palettes";
import { createNeonPipesScene, referenceRig } from "./scene/NeonPipesScene";

export type NeonPipesProps = { variant: "v1" | "v2" };

export const NeonPipes: React.FC<NeonPipesProps> = ({ variant }) => {
  const factory = useMemo(
    () =>
      createNeonPipesScene(
        variant === "v1" ? referencePalette : emberTealPalette,
        referenceRig,
      ),
    [variant],
  );
  return <ThreeStage factory={factory} />;
};
