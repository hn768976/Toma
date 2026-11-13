import React, { useMemo } from "react";
import { ThreeStage } from "./engine/ThreeStage";
import { createBloodScene } from "./blood/BloodScene";
import { CRIMSON, VENOUS } from "./blood/palettes";

export type BloodCellsProps = {
  /** "crimson" matches the reference, "venous" is the alternative palette. */
  palette: "crimson" | "venous";
};

export const BloodCells: React.FC<BloodCellsProps> = ({ palette }) => {
  const pal = palette === "venous" ? VENOUS : CRIMSON;
  const factory = useMemo(() => createBloodScene(pal), [pal]);
  return <ThreeStage factory={factory} background={pal.background} />;
};
