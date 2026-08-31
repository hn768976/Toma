import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./config";
import { ErrorCascade } from "./ErrorCascade";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* >>> composition:light — dropped from the dark-only bundle by scripts/package.mjs */}
      <Composition
        id="ErrorCascadeLight"
        component={ErrorCascade}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "light" as const }}
      />
      {/* <<< composition:light */}
      {/* >>> composition:dark — dropped from the light-only bundle by scripts/package.mjs */}
      <Composition
        id="ErrorCascadeDark"
        component={ErrorCascade}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "dark" as const }}
      />
      {/* <<< composition:dark */}
    </>
  );
};
