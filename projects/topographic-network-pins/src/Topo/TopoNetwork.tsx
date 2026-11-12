import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeStage } from "../lib/ThreeStage";
import { PALETTES, createTopoScene } from "./scene";

export type TopoNetworkProps = { palette: keyof typeof PALETTES };

export const TopoNetwork: React.FC<TopoNetworkProps> = ({ palette }) => {
  const factory = useMemo(() => createTopoScene(PALETTES[palette]), [palette]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeStage factory={factory} />
    </AbsoluteFill>
  );
};
