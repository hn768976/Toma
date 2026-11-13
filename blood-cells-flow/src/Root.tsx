import React from "react";
import { Composition } from "remotion";
import { BloodCells } from "./BloodCells";

// 4K UHD master. Deliverables are rendered from these compositions with
// `--scale=0.5` (1920x1080); a plain render produces the native 4K file.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
// Reference clip: 301 frames @ 30 fps = 10.033 s.
const DURATION_IN_FRAMES = 301;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BloodCells-V1"
        component={BloodCells}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "crimson" as const }}
      />
      <Composition
        id="BloodCells-V2"
        component={BloodCells}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "venous" as const }}
      />
    </>
  );
};
