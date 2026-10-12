import React from "react";
import { CanvasLook } from "../lib/CanvasLook";
import { drawNumberMatrix, NumberMatrixProps } from "./numberMatrix";

const GRAIN = { amount: 0.015, cleanBlack: true };

export const NumberMatrix: React.FC<NumberMatrixProps> = (props) => (
  <CanvasLook draw={drawNumberMatrix} props={props} grain={GRAIN} />
);
