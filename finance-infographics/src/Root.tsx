import React from "react";
import { Composition } from "remotion";
import { FinanceInfographics } from "./fin/FinanceInfographics";

// Reference clip: 30.000 s @ 30 fps = 900 frames.
export const FPS = 30;
export const DURATION_IN_FRAMES = 900;
export const WIDTH = 3840; // 4K UHD composition
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FinanceInfographics-V1-SlowPush-4K"
        component={FinanceInfographics}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="FinanceInfographics-V2-OrbitGlide-4K"
        component={FinanceInfographics}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
