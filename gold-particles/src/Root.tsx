import React from "react";
import { Composition } from "remotion";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  DURATION_IN_FRAMES,
  FPS,
} from "./constants";
import { ParticleWave, particleWaveSchema } from "./ParticleWave";

// Both compositions are authored at 3840x2160 so they can be rendered
// at 4K later; render previews with --scale=0.5 for 1920x1080.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GoldParticleWave"
        component={ParticleWave}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={particleWaveSchema}
        defaultProps={{ variant: "gold" as const }}
      />
      <Composition
        id="SilverParticleWave"
        component={ParticleWave}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={particleWaveSchema}
        defaultProps={{ variant: "silver" as const }}
      />
    </>
  );
};
