import React from "react";
import { Composition } from "remotion";
import { HoloGlobe } from "./HoloGlobe";

// Both versions are authored at native 4K UHD. Deliverables are rendered
// from these same compositions with `--scale=0.5` (1920x1080).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
// Reference clip: 900 frames @ 30 fps = 30.000 s.
const DURATION = 900;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HoloGlobeV1"
        component={HoloGlobe}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ version: "v1" as const }}
      />
      <Composition
        id="HoloGlobeV2"
        component={HoloGlobe}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ version: "v2" as const }}
      />
    </>
  );
};
