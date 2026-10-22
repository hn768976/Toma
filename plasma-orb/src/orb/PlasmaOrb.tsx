import { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeStage } from "../gl/ThreeStage";
import { createOrbStage } from "./scene";
import { ELECTRIC_VIOLET, SOLAR_GOLD } from "./palettes";

export type PlasmaOrbProps = { variant: "v1" | "v2" };

export const PlasmaOrb: React.FC<PlasmaOrbProps> = ({ variant }) => {
  const create = useMemo(
    () => createOrbStage(variant === "v1" ? ELECTRIC_VIOLET : SOLAR_GOLD),
    [variant],
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeStage create={create} />
    </AbsoluteFill>
  );
};
