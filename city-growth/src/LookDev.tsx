import React from "react";
import { useCurrentFrame } from "remotion";
import { CityFrame } from "./CityGrowth";

/** The three key moments used for look development: start, peak, settled. */
export const LOOKDEV_MOMENTS = [45, 112, 337] as const;

/** A 3-frame still composition: frame i shows key moment i of Version 1. */
export const LookDev: React.FC = () => {
  const frame = useCurrentFrame();
  const moment = LOOKDEV_MOMENTS[Math.min(frame, LOOKDEV_MOMENTS.length - 1)];
  return <CityFrame frame={moment} variant="v1" />;
};
