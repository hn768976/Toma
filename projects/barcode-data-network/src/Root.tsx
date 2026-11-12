import React from "react";
import { Composition } from "remotion";
import { BarcodeDataNetwork } from "./BarcodeDataNetwork";

// Authored at 4K UHD. The reference clip is 551 frames @ 30 fps (18.367 s).
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION = 551;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="BarcodeDataNetwork-V1"
      component={BarcodeDataNetwork}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "v1" as const }}
    />
    <Composition
      id="BarcodeDataNetwork-V2"
      component={BarcodeDataNetwork}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "v2" as const }}
    />
  </>
);
