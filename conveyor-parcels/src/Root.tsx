import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./config";
import { Conveyor } from "./Conveyor";
import { LookDev, LOOKDEV_MOMENTS } from "./LookDev";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-conveyor-parcels"
        component={Conveyor}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="V2-conveyor-parcels"
        component={Conveyor}
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
