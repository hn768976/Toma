import { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeStage } from "../gl/ThreeStage";
import { createWaveStage } from "./scene";
import { FLYOVER_RIG, HOVER_RIG, TEAL } from "./looks";

export type ParticleWavesProps = { variant: "v1" | "v2" };

export const ParticleWaves: React.FC<ParticleWavesProps> = ({ variant }) => {
  const create = useMemo(
    () => variant === "v1"
        ? createWaveStage(TEAL, HOVER_RIG, 5.6)
        : createWaveStage(TEAL, FLYOVER_RIG, 8.5),
    [variant],
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeStage create={create} />
    </AbsoluteFill>
  );
};
