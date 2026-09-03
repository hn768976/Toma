import React from "react";
import { Composition } from "remotion";
import { NeonFrame } from "./neon-frame/NeonFrame";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./neon-frame/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NeonFrameBlue"
        component={NeonFrame}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
      <Composition
        id="NeonFrameAmber"
        component={NeonFrame}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "amber" as const }}
      />
    </>
  );
};
