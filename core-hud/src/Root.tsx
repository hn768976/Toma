import React from "react";
import { Composition } from "remotion";
import { CoreHud } from "./CoreHud";
import { DURATION, FPS, FRAME_HEIGHT, FRAME_WIDTH } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CoreHudNodes"
        component={CoreHud}
        durationInFrames={DURATION}
        fps={FPS}
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        defaultProps={{ variant: "nodes" as const }}
      />
      <Composition
        id="CoreHudRings"
        component={CoreHud}
        durationInFrames={DURATION}
        fps={FPS}
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        defaultProps={{ variant: "rings" as const }}
      />
    </>
  );
};
