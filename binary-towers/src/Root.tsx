import React from "react";
import { Composition } from "remotion";
import { BinaryTowers, BinaryTowersProps } from "./BinaryTowers";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-BinaryTowersBlue"
      component={BinaryTowers}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "blue" }}
    />
    <Composition
      id="V2-BinaryTowersMono"
      component={BinaryTowers}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "mono" }}
    />
  </>
);
