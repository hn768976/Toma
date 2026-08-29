import React from "react";
import { Composition } from "remotion";
import { LabDashboard } from "./LabDashboard";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./layout";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LabDashGreen"
        component={LabDashboard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "steady" as const }}
      />
      <Composition
        id="LabDashAlert"
        component={LabDashboard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "alert" as const }}
      />
    </>
  );
};
