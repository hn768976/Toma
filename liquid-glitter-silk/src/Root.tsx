import React from "react";
import { Composition } from "remotion";
import { LiquidGlitterSilk, type LiquidGlitterSilkProps } from "./LiquidGlitterSilk";

// Reference clip: 240 frames (8.008 s @ 29.97 fps) -> 240 frames @ 30 fps.
export const FPS = 30;
export const DURATION_IN_FRAMES = 240;
// Native 4K UHD compositions. Final 1080p deliverables are rendered with --scale=0.5.
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LiquidGlitterSilk-V1-Reference"
        component={LiquidGlitterSilk}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "limeMagenta" } satisfies LiquidGlitterSilkProps}
      />
      <Composition
        id="LiquidGlitterSilk-V2-AquaGold"
        component={LiquidGlitterSilk}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "aquaGold" } satisfies LiquidGlitterSilkProps}
      />
    </>
  );
};
