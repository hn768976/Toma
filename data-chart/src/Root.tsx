import React from "react";
import { Composition } from "remotion";
import "./load-fonts";
import { DataChart } from "./chart/DataChart";
import {
  COMP_DURATION,
  COMP_FPS,
  COMP_HEIGHT,
  COMP_WIDTH,
} from "./chart/timing";

const base = {
  durationInFrames: COMP_DURATION,
  fps: COMP_FPS,
  width: COMP_WIDTH,
  height: COMP_HEIGHT,
  component: DataChart,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-ChartLineDark"
        {...base}
        defaultProps={{ variant: "line", theme: "dark" } as const}
      />
      <Composition
        id="V2-ChartBarDark"
        {...base}
        defaultProps={{ variant: "bar", theme: "dark" } as const}
      />
      <Composition
        id="V3-ChartAreaDark"
        {...base}
        defaultProps={{ variant: "area", theme: "dark" } as const}
      />
      <Composition
        id="V4-ChartLineLight"
        {...base}
        defaultProps={{ variant: "line", theme: "light" } as const}
      />
    </>
  );
};
