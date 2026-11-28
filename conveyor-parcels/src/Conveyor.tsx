import React, { useCallback } from "react";
import { Variant } from "./config";
import { Stage } from "./engine/Stage";
import { lookFor } from "./look";
import { makeWorld } from "./world";

export const Conveyor: React.FC<{ variant: Variant }> = ({ variant }) => {
  const factory = useCallback(() => makeWorld(variant), [variant]);
  return <Stage makeWorld={factory} look={lookFor(variant)} />;
};
