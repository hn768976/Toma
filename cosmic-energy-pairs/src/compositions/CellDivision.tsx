import React from "react";
import { CellColours } from "../colourways";
import { Stage } from "../lib/Stage";
import { useLookFactory } from "../lib/useLookFactory";
import { CELL_FRAMES_TOTAL, CELL_POST, CellLook } from "../looks/cells";

export const CELL_FRAMES = CELL_FRAMES_TOTAL;

export const CellDivision: React.FC<{ colours: CellColours }> = ({ colours }) => {
  const create = useLookFactory(colours, (c) => new CellLook(c));
  return <Stage create={create} post={CELL_POST} />;
};
