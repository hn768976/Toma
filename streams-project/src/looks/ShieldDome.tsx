import React, { useMemo } from "react";
import { ThreeStage } from "../lib/ThreeStage";
import { createShieldDome, ShieldDomeProps } from "./shieldDome";

export const ShieldDome: React.FC<ShieldDomeProps> = ({ mode }) => {
  const create = useMemo(() => createShieldDome({ mode }), [mode]);
  return <ThreeStage create={create} />;
};
