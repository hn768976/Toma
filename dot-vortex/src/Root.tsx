import React from "react";
import { Composition } from "remotion";
import { DotVortex } from "./vortex/DotVortex";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./vortex/constants";

// Both compositions are defined at 3840x2160 so they can be rendered at
// 4K; the 1080p preview is the same composition at --scale=0.5.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-DotVortexGold"
        component={DotVortex}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "gold" as const }}
      />
      <Composition
        id="V2-DotVortexCyan"
        component={DotVortex}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "cyan" as const }}
      />
    </>
  );
};
