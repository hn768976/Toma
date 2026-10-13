import React, { useMemo } from "react";
import { ThreeStage } from "../lib/ThreeStage";
import { createPillSpill, PillSpillProps } from "./pillSpill";

export const PillSpill: React.FC<PillSpillProps> = (props) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useMemo(() => createPillSpill(props), [JSON.stringify(props)]);
  return <ThreeStage create={create} />;
};
