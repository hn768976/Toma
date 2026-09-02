import React from "react";
import { GrainVignettePass } from "../../lib/GrainVignettePass";
import { DURATION_IN_FRAMES } from "../constants";

/** Vignette and film grain, over everything. */
export const FinishPass: React.FC<{
  vignetteStrength: number;
  grainAlpha: number;
}> = ({ vignetteStrength, grainAlpha }) => (
  <GrainVignettePass
    vignetteStrength={vignetteStrength}
    grainAlpha={grainAlpha}
    loopFrames={DURATION_IN_FRAMES}
  />
);
