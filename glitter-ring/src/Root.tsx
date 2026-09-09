import React from "react";
import { Composition } from "remotion";
import {
  GlitterRing,
  glitterRingDefaults,
} from "./glitter-ring/GlitterRing";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./glitter-ring/constants";

// All three versions are defined at 3840x2160 so they can be rendered at 4K.
// Preview renders use --scale=0.5 for 1920x1080.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-GlitterRingGold"
        component={GlitterRing}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ ...glitterRingDefaults, palette: "gold" as const }}
      />
      <Composition
        id="V2-GlitterRingSilver"
        component={GlitterRing}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ ...glitterRingDefaults, palette: "silver" as const }}
      />
      <Composition
        id="V3-GlitterRingRoseGold"
        component={GlitterRing}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ ...glitterRingDefaults, palette: "roseGold" as const }}
      />
    </>
  );
};
