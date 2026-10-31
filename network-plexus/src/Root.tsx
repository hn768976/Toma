import React from "react";
import { Composition } from "remotion";
import { NetworkPlexus } from "./plexus/NetworkPlexus";

// Reference: 21.666 s @ 30 fps = 650 frames. Compositions are authored in
// native 4K UHD; deliverables are rendered at 1080p with --scale=0.5.
const FPS = 30;
const DURATION_IN_FRAMES = 650;
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NetworkPlexus-V1-Reference"
        component={NetworkPlexus}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1-reference" as const }}
      />
      <Composition
        id="NetworkPlexus-V2-CraneOrbit"
        component={NetworkPlexus}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2-orbit" as const }}
      />
    </>
  );
};
