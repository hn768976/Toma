import React from "react";
import { Composition } from "remotion";
import { CityGrowth } from "./CityGrowth";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./config";
import { LookDev, LOOKDEV_MOMENTS } from "./LookDev";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-city-growth"
        component={CityGrowth}
        defaultProps={{ variant: "v1" as const }}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="V2-city-growth"
        component={CityGrowth}
        defaultProps={{ variant: "v2" as const }}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="LookDev"
        component={LookDev}
        durationInFrames={LOOKDEV_MOMENTS.length}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
