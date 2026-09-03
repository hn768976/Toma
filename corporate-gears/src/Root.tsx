import React from "react";
import { Composition } from "remotion";
import "./load-fonts";
import {
  CorporateGears,
  corporateGearsBlueProps,
  corporateGearsGoldProps,
} from "./CorporateGears";

/** 4K master. Render the 1080p preview with --scale=0.5. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 300;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-GearsGold"
      component={CorporateGears}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={DURATION_IN_FRAMES}
      defaultProps={corporateGearsGoldProps}
    />
    <Composition
      id="V2-GearsBlue"
      component={CorporateGears}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={DURATION_IN_FRAMES}
      defaultProps={corporateGearsBlueProps}
    />
  </>
);
