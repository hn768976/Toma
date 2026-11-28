import React, { useCallback } from "react";
import { DURATION_IN_FRAMES, Variant } from "./config";
import { Stage } from "./engine/Stage";
import { lookFor } from "./look";
import { makeWorld } from "./world";

export const Conveyor: React.FC<{ variant: Variant; atFrame?: number }> = ({ variant, atFrame }) => {
  const factory = useCallback(() => makeWorld(variant), [variant]);
  return <Stage makeWorld={factory} look={lookFor(variant)} loopFrames={DURATION_IN_FRAMES} atFrame={atFrame} />;
};
