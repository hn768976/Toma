import React from "react";
import { Composition } from "remotion";
import { FibreCorridor } from "./fibre/FibreCorridor";
import { FPS, HEIGHT, LOOP, WIDTH } from "./fibre/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FibreRising"
        component={FibreCorridor}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "rising" as const }}
      />
      <Composition
        id="FibreDescending"
        component={FibreCorridor}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "descending" as const }}
      />
      <Composition
        id="FibreTunnel"
        component={FibreCorridor}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "tunnel" as const }}
      />
    </>
  );
};
