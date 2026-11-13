import React, { useMemo } from "react";
import { ThreeStage } from "./engine/ThreeStage";
import { createHudFactory, HudVariant } from "./hud/scene";

export const HudDataGrid: React.FC<{ variant: HudVariant; debug?: boolean; profile?: boolean }> = ({
  variant,
  debug,
  profile,
}) => {
  const factory = useMemo(() => createHudFactory(variant, debug), [variant, debug]);
  return <ThreeStage factory={factory} profile={profile} />;
};
