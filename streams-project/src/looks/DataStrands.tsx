import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { useFontReady } from "../lib/useFont";
import { ThreeStage } from "../lib/ThreeStage";
import { createDataStrands, DataStrandsProps } from "./dataStrands";

export const DataStrands: React.FC<DataStrandsProps> = (props) => {
  const ready = useFontReady();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useMemo(() => createDataStrands(props), [JSON.stringify(props)]);
  // The canvas mounts only once the font is in, so the text atlas is built once.
  return <AbsoluteFill style={{ background: "#000" }}>{ready ? <ThreeStage create={create} /> : null}</AbsoluteFill>;
};
