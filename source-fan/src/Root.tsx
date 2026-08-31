import React from "react";
import { Composition } from "remotion";
import { SourceFan } from "./source-fan/SourceFan";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./source-fan/layout";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SourceFanBlue"
        component={SourceFan}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
      <Composition
        id="SourceFanDark"
        component={SourceFan}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "dark" as const }}
      />
    </>
  );
};
