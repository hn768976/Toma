import React from "react";
import { Composition } from "remotion";
import { SunburstFlare } from "./sunburst/SunburstFlare";

// Reference clip: 16.85 s (1011 frames @ 60 fps). At exactly 30 fps the
// closest whole-frame length is 505.5 frames; we use 506 frames = 16.867 s
// (|Δ| = 17 ms, half a frame) so the clip never ends early.
export const FPS = 30;
export const DURATION_IN_FRAMES = 506;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SunburstFlare-V1-Reference"
        component={SunburstFlare}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "locked" as const }}
      />
      <Composition
        id="SunburstFlare-V2-CameraPan"
        component={SunburstFlare}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "pan" as const }}
      />
    </>
  );
};
