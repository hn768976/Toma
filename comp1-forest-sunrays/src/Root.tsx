import React from "react";
import { Composition } from "remotion";
import { ForestSunrays } from "./forest/ForestSunrays";

// Reference clip: 20.02 s (600 frames @ 29.97 fps). At exactly 30 fps the
// closest whole-frame length is 601 frames = 20.033 s (|Δ| = 13 ms < 1 frame).
export const FPS = 30;
export const DURATION_IN_FRAMES = 601;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ForestSunrays-V1-Reference"
        component={ForestSunrays}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "reference" as const }}
      />
      <Composition
        id="ForestSunrays-V2-GoldenHour"
        component={ForestSunrays}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "golden-hour" as const }}
      />
    </>
  );
};
