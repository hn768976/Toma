import React, { useMemo } from "react";
import { ThreeStage } from "../../gfx/ThreeStage";
import { useFontsGate } from "../../lib/fonts";
import { createBoardRig } from "./BoardRig";
import type { BoardPalette } from "./data";

/** Look 1: Rate Board (three.js + Canvas 2D texture, WebGL2). The palette is the version. */
export const RateBoard: React.FC<{ palette: BoardPalette }> = ({ palette }) => {
  const ready = useFontsGate("RateBoard fonts");
  const factory = useMemo(() => createBoardRig(palette), [palette]);
  if (!ready) return null;
  return <ThreeStage factory={factory} />;
};
