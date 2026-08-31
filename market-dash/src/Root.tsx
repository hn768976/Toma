import React from "react";
import { Composition } from "remotion";
import { MarketDash } from "./market-dash/MarketDash";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./market-dash/layout";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MarketDashBlue"
        component={MarketDash}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
      <Composition
        id="MarketDashGreen"
        component={MarketDash}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "green" as const }}
      />
      <Composition
        id="MarketDashNight"
        component={MarketDash}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "night" as const }}
      />
    </>
  );
};
