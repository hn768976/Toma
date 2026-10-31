import React, { useMemo } from "react";
import { ThreeStage } from "../lib/ThreeStage";
import { FIRE, PLASMA } from "./palette";
import { createEmberStage } from "./scene";

export type EmberNovaProps = { palette: "fire" | "plasma" };

export const EmberNova: React.FC<EmberNovaProps> = ({ palette }) => {
  const factory = useMemo(
    () => createEmberStage(palette === "plasma" ? PLASMA : FIRE),
    [palette],
  );
  return <ThreeStage factory={factory} background="#000" />;
};
