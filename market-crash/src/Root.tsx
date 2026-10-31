import React from "react";
import { Composition } from "remotion";
import { MarketCrash } from "./crash/MarketCrash";

// Reference: 13.333 s @ 30 fps = 400 frames. Compositions are authored in
// native 4K UHD; deliverables are rendered at 1080p with --scale=0.5.
const FPS = 30;
const DURATION_IN_FRAMES = 400;
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MarketCrash-V1-Reference"
        component={MarketCrash}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1-reference" as const }}
      />
      <Composition
        id="MarketCrash-V2-Arctic"
        component={MarketCrash}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2-arctic" as const }}
      />
    </>
  );
};
