import React, { useMemo } from "react";
import { ThreeStage } from "./engine/ThreeStage";
import { createChipScene } from "./chips/ChipScene";
import { CRANE_DOWN, REFERENCE_ORBIT } from "./chips/looks";

export type MicrochipsProps = {
  /** "orbit" matches the reference, "crane" is the alternative camera move. */
  camera: "orbit" | "crane";
};

export const Microchips: React.FC<MicrochipsProps> = ({ camera }) => {
  const look = camera === "crane" ? CRANE_DOWN : REFERENCE_ORBIT;
  const factory = useMemo(() => createChipScene(look), [look]);
  return <ThreeStage factory={factory} background="#0b0f16" />;
};
