import React from "react";
import { Composition } from "remotion";
import { NeonTunnel } from "./tunnel/NeonTunnel";
import { MAGENTA_VIOLET, WARM_SEPIA } from "./tunnel/palettes";

// Reference clip: 13.12 s. At 30 fps the closest whole-frame length is 394 frames (13.133 s).
export const FPS = 30;
export const DURATION_IN_FRAMES = 394;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NeonTunnel-V1"
        component={NeonTunnel}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: WARM_SEPIA }}
      />
      <Composition
        id="NeonTunnel-V2"
        component={NeonTunnel}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: MAGENTA_VIOLET }}
      />
    </>
  );
};
