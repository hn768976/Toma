import React from "react";
import { Composition } from "remotion";
import { Microchips } from "./Microchips";

// 4K UHD master. Deliverables are rendered from these compositions with
// `--scale=0.5` (1920x1080); a plain render produces the native 4K file.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
// Reference clip: 12.04 s (301 frames @ 25 fps). At 30 fps the closest
// whole-frame duration is 361 frames = 12.033 s.
const DURATION_IN_FRAMES = 361;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Microchips-V1"
        component={Microchips}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "orbit" as const }}
      />
      <Composition
        id="Microchips-V2"
        component={Microchips}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "crane" as const }}
      />
    </>
  );
};
