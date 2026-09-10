import React from "react";
import { Composition } from "remotion";
import {
  DURATION_IN_FRAMES,
  FPS,
  GOLD,
  HEIGHT,
  SILVER,
  WIDTH,
} from "./config";
import { ZodiacScene, type ZodiacSceneProps } from "./ZodiacScene";

const shared = {
  turns: 1,
  burstTurns: 2,
  labelMode: "curved",
  grain: 0.5,
} satisfies Partial<ZodiacSceneProps>;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-ZodiacWheelGold"
      component={ZodiacScene}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{
        ...shared,
        palette: GOLD,
        variantKey: "gold",
        seed: 20260910,
        starCount: 2200,
      }}
    />
    <Composition
      id="V2-ZodiacWheelSilver"
      component={ZodiacScene}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{
        ...shared,
        palette: SILVER,
        variantKey: "silver",
        seed: 771102,
        starCount: 2500,
      }}
    />
  </>
);
