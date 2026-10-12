import React from "react";
import { CanvasLook } from "../lib/CanvasLook";
import { drawRadialHud, RadialHudProps } from "./radialHud";

const GRAIN = { amount: 0.015, cleanBlack: true };

export const RadialHud: React.FC<RadialHudProps> = (props) => (
  <CanvasLook draw={drawRadialHud} props={props} grain={GRAIN} />
);
