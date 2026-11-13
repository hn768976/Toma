import React, { useMemo } from "react";
import { ThreeStage } from "./engine/ThreeStage";
import { createDashFactory, DashVariant } from "./dash/scene";
import { EMERALD_PALETTE, REFERENCE_PALETTE } from "./dash/palette";

export const FinanceDashboard: React.FC<{ variant: DashVariant; debug?: boolean; profile?: boolean }> = ({
  variant,
  debug,
  profile,
}) => {
  const factory = useMemo(
    () => createDashFactory(variant === "reference" ? REFERENCE_PALETTE : EMERALD_PALETTE, debug),
    [variant, debug],
  );
  return <ThreeStage factory={factory} profile={profile} />;
};
