import React from "react";
import { Composition } from "remotion";
import { MarketFlythrough } from "./MarketFlythrough";

// Both versions are authored at native 4K UHD. Deliverables are rendered
// from these same compositions with `--scale=0.5` (1920x1080).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
// Reference clip: 400 frames @ 30 fps = 13.333 s.
const DURATION = 400;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MarketFlythroughV1"
        component={MarketFlythrough}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ version: "v1" as const }}
      />
      <Composition
        id="MarketFlythroughV2"
        component={MarketFlythrough}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ version: "v2" as const }}
      />
    </>
  );
};
