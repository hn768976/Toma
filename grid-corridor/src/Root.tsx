import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { GridCorridor } from "./GridCorridor";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GridCorridorTeal"
        component={GridCorridor}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "teal" as const }}
      />
      <Composition
        id="GridCorridorAmber"
        component={GridCorridor}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "amber" as const }}
      />
      <Composition
        id="GridCorridorGreen"
        component={GridCorridor}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "green" as const }}
      />
    </>
  );
};
