import React, { useMemo } from "react";
import { ThreeStage } from "./ThreeStage";
import {
  createSpiralBloomScene,
  dollyRackRig,
  staticRig,
} from "./scene/SpiralBloomScene";

export type SpiralBloomsProps = { variant: "v1" | "v2" };

export const SpiralBlooms: React.FC<SpiralBloomsProps> = ({ variant }) => {
  const factory = useMemo(
    () => createSpiralBloomScene(variant === "v1" ? staticRig : dollyRackRig),
    [variant],
  );
  return <ThreeStage factory={factory} />;
};
