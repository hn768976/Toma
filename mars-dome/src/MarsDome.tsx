import React, { useCallback } from "react";
import { Variant } from "./config";
import { Stage } from "./engine/Stage";
import { LOOK } from "./look";
import { makeWorld } from "./world";

export const MarsDome: React.FC<{ variant: Variant }> = ({ variant }) => {
  const factory = useCallback(() => makeWorld(variant), [variant]);
  return <Stage makeWorld={factory} look={LOOK} />;
};
