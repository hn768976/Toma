import React from "react";
import { Composition } from "remotion";
import { DataWall } from "./DataWall";
import { DURATION, FPS, HEIGHT, WIDTH } from "./plane";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DataWallBlue"
        component={DataWall}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
      <Composition
        id="DataWallAmber"
        component={DataWall}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "amber" as const }}
      />
    </>
  );
};
