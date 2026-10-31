import React from "react";
import { Composition } from "remotion";
import { StageLights } from "./stage/StageLights";

// Reference clip: 300 frames @ 29.97 fps (10.01 s). At exactly 30 fps the
// same 300 frames give 10.000 s, the closest whole-frame match.
const FPS = 30;
const DURATION_IN_FRAMES = 300;

// Compositions are authored in 4K UHD. Deliverables are rendered at 1080p
// with `--scale=0.5` (see README).
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="StageLights-V1-4K"
        component={StageLights}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ cameraMove: "locked-off" as const }}
      />
      <Composition
        id="StageLights-V2-4K"
        component={StageLights}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ cameraMove: "crane-arc" as const }}
      />
    </>
  );
};
