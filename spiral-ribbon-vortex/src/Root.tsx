import React from "react";
import { Composition } from "remotion";
import {
  SpiralRibbonVortex,
  type SpiralRibbonVortexProps,
} from "./vortex/SpiralRibbonVortex";

// Reference clip: 270 frames (9.009 s @ 29.97 fps) -> 270 frames @ 30 fps.
export const FPS = 30;
export const DURATION_IN_FRAMES = 270;
// Native 4K UHD compositions. Final 1080p deliverables are rendered with --scale=0.5.
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SpiralRibbonVortex-V1-Reference"
        component={SpiralRibbonVortex}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ cameraMove: "referenceDrift" } satisfies SpiralRibbonVortexProps}
      />
      <Composition
        id="SpiralRibbonVortex-V2-OrbitPlunge"
        component={SpiralRibbonVortex}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ cameraMove: "orbitPlunge" } satisfies SpiralRibbonVortexProps}
      />
    </>
  );
};
