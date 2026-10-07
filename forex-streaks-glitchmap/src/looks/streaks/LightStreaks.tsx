import React, { useMemo } from "react";
import { ThreeStage } from "../../gfx/ThreeStage";
import { createStreaksRig } from "./StreaksRig";
import type { StreaksPalette } from "./palettes";

/** Look 2: Light Streaks (three.js, WebGL2). The palette is the version. */
export const LightStreaks: React.FC<{ palette: StreaksPalette }> = ({ palette }) => {
  const factory = useMemo(() => createStreaksRig(palette), [palette]);
  return <ThreeStage factory={factory} />;
};
