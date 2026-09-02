import React from "react";
import { Composition } from "remotion";
import { CloudIcon } from "./CloudIcon";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./config";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CloudIcon"
      component={CloudIcon}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "blue" as const }}
    />
  );
};
