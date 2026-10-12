import React from "react";
import { CanvasLook } from "../lib/CanvasLook";
import { drawNebulaHud, NebulaHudProps } from "./nebulaHud";

const GRAIN = { amount: 0.015, cleanBlack: false };

export const NebulaHud: React.FC<NebulaHudProps> = (props) => (
  <CanvasLook draw={drawNebulaHud} props={props} grain={GRAIN} />
);
