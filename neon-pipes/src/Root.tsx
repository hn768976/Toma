import React from "react";
import { Composition } from "remotion";
import { NeonPipes } from "./NeonPipes";

/** 4K UHD composition size. Delivery renders downsample with --scale=0.5. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** Reference clip: 270 frames (9.009 s @ 29.97). Kept at 270 frames @ 30 fps = 9.000 s. */
export const DURATION = 270;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NeonPipes-V1-Reference"
        component={NeonPipes}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="NeonPipes-V2-EmberTeal"
        component={NeonPipes}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
