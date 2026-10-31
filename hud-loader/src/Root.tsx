import React from "react";
import { Composition } from "remotion";
import { HudLoaderV1, HudLoaderV2 } from "./hud/HudLoader";

// Reference clip: exactly 12.00 s -> 360 frames at 30 fps.
export const FPS = 30;
export const DURATION_IN_FRAMES = 360;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HudLoader-V1"
        component={HudLoaderV1}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="HudLoader-V2"
        component={HudLoaderV2}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
