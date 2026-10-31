import React from "react";
import { Composition } from "remotion";
import { EmberNova } from "./ember/EmberNova";
import { DURATION } from "./ember/timeline";

// Both compositions are authored at 4K UHD (3840x2160) @ 30 fps.
// Reference clip: 9.000 s -> 270 frames.
const FPS = 30;
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EmberNova-V1"
        component={EmberNova}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        durationInFrames={Math.round(DURATION * FPS)}
        defaultProps={{ palette: "fire" as const }}
      />
      <Composition
        id="EmberNova-V2"
        component={EmberNova}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        durationInFrames={Math.round(DURATION * FPS)}
        defaultProps={{ palette: "plasma" as const }}
      />
    </>
  );
};
