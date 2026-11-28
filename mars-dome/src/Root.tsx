import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./config";
import { LookDev, LOOKDEV_MOMENTS } from "./LookDev";
import { MarsDome } from "./MarsDome";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-mars-dome"
        component={MarsDome}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="V2-mars-dome"
        component={MarsDome}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2" as const }}
      />
      <Composition
        id="LookDev"
        component={LookDev}
        fps={FPS}
        durationInFrames={LOOKDEV_MOMENTS.length}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" as const }}
      />
    </>
  );
};
