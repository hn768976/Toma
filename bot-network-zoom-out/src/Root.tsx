import React from "react";
import { Composition } from "remotion";
import { BotNetwork } from "./BotNetwork";

// Reference clip: 16.04 s. At 30 fps that is 481 frames (16.033 s) - the
// closest whole-frame duration.
export const FPS = 30;
export const DURATION_IN_FRAMES = 481;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BotNetwork-V1-Reference"
        component={BotNetwork}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "reference" as const }}
      />
      <Composition
        id="BotNetwork-V2-DuskPalette"
        component={BotNetwork}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "dusk" as const }}
      />
    </>
  );
};
