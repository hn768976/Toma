import React from "react";
import { Composition } from "remotion";
import {
  DataCentre,
  dataCentreDefaults,
  type DataCentreProps,
} from "./data-centre/DataCentre";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./data-centre/constants";

const common = {
  component: DataCentre,
  durationInFrames: DURATION_IN_FRAMES,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DataCentreDark"
        {...common}
        defaultProps={{ ...dataCentreDefaults, theme: "dark" } as DataCentreProps}
      />
      <Composition
        id="DataCentreLight"
        {...common}
        defaultProps={{ ...dataCentreDefaults, theme: "light" } as DataCentreProps}
      />
    </>
  );
};
