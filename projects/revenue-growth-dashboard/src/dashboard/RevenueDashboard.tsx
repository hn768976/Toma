import { useMemo } from "react";
import { GLCanvas } from "../lib/GLCanvas";
import { AMBER_PALETTE, REFERENCE_PALETTE } from "./palette";
import { makeDashboardFactory } from "./scene";

export type RevenueDashboardProps = { variant: "reference" | "amber" };

export const RevenueDashboard: React.FC<RevenueDashboardProps> = ({ variant }) => {
  const factory = useMemo(
    () => makeDashboardFactory(variant === "amber" ? AMBER_PALETTE : REFERENCE_PALETTE),
    [variant],
  );
  return <GLCanvas factory={factory} />;
};
