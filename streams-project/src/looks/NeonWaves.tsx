import React, { useMemo } from "react";
import { ThreeStage } from "../lib/ThreeStage";
import { createNeonWaves, NeonWavesProps } from "./neonWaves";

export const NeonWaves: React.FC<NeonWavesProps> = (props) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useMemo(() => createNeonWaves(props), [JSON.stringify(props)]);
  return <ThreeStage create={create} />;
};
