import React from "react";
import { Composition } from "remotion";
import {
  GOLD_SAPPHIRE_PALETTE,
  IridescentFoil,
  REFERENCE_PALETTE,
  foilSchema,
} from "./IridescentFoil";

// 4K UHD, 30 fps. 202 frames = the reference clip's exact frame count
// (6.733 s at 30 fps vs. the reference's 6.740 s at 29.97 fps).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION_IN_FRAMES = 202;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="IridescentFoil-V1-Reference"
        component={IridescentFoil}
        schema={foilSchema}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={REFERENCE_PALETTE}
      />
      <Composition
        id="IridescentFoil-V2-GoldSapphire"
        component={IridescentFoil}
        schema={foilSchema}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={GOLD_SAPPHIRE_PALETTE}
      />
    </>
  );
};
