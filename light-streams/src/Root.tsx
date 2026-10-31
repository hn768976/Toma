import React from "react";
import { Composition } from "remotion";
import { LightStreams, lightStreamsSchema } from "./streams/LightStreams";

// 4K UHD compositions. Final 1080p deliverables are rendered from these
// with `--scale=0.5` (see README).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
// Reference clip: 8.04 s (201 frames @ 25 fps). At 30 fps the closest whole
// frame count is 241 frames = 8.033 s (a 30 fps clip cannot be 241.2 frames).
const DURATION_IN_FRAMES = 241;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LightStreams-V1"
        component={LightStreams}
        schema={lightStreamsSchema}
        defaultProps={{ version: "reference" as const }}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="LightStreams-V2"
        component={LightStreams}
        schema={lightStreamsSchema}
        defaultProps={{ version: "alt-camera" as const }}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
