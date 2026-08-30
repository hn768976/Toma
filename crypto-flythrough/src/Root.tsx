import React from "react";
import { Composition } from "remotion";
import { CodeFlythrough } from "./CodeFlythrough";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./variants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CryptoFlyTeal"
        component={CodeFlythrough}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "teal" as const }}
      />
      <Composition
        id="CryptoFlyBlue"
        component={CodeFlythrough}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
    </>
  );
};
