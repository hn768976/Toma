import React from "react";
import { ThreeStage } from "./engine/ThreeStage";
import { ChipVariant, createChipScene } from "./scenes/ChipScene";

export const QuantumDataChip: React.FC<{ variant: ChipVariant }> = ({ variant }) => (
  <ThreeStage create={() => createChipScene(variant)} />
);
