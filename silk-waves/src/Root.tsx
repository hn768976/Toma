import React from "react";
import { Composition } from "remotion";
import { SilkWaves, silkWavesSchema } from "./silk/SilkWaves";

// 4K UHD compositions. Final 1080p deliverables are rendered from these
// with `--scale=0.5` (see README).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
// Reference clip: 10.000 s => 300 frames at 30 fps.
const DURATION_IN_FRAMES = 300;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SilkWaves-V1"
        component={SilkWaves}
        schema={silkWavesSchema}
        defaultProps={{ palette: "midnight-navy" as const }}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SilkWaves-V2"
        component={SilkWaves}
        schema={silkWavesSchema}
        defaultProps={{ palette: "champagne-gold" as const }}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
