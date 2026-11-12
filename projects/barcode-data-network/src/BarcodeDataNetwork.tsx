import React from "react";
import { ThreeStage } from "./engine/ThreeStage";
import { BarcodeVariant, createBarcodeScene } from "./scenes/BarcodeScene";

export const BarcodeDataNetwork: React.FC<{ variant: BarcodeVariant }> = ({ variant }) => (
  <ThreeStage create={() => createBarcodeScene(variant)} />
);
