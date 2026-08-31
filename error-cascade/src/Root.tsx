import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./config";
import { ErrorCascade } from "./ErrorCascade";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ErrorCascadeLight"
        component={ErrorCascade}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "light" as const }}
      />
      <Composition
        id="ErrorCascadeDark"
        component={ErrorCascade}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "dark" as const }}
      />
    </>
  );
};
