import React from "react";
import { Composition } from "remotion";
import { HalftoneWave, halftoneWaveDefaults } from "./halftone/HalftoneWave";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./halftone/constants";

// Both compositions are defined at the 3840x2160 master size. A 1080p
// preview is a --scale=0.5 render of the same composition, not a separate
// one, so the two resolutions can never drift apart.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-HalftoneWaveMagenta"
        component={HalftoneWave}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ ...halftoneWaveDefaults, palette: "magenta" as const }}
      />
      <Composition
        id="V2-HalftoneWaveCyan"
        component={HalftoneWave}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ ...halftoneWaveDefaults, palette: "cyan" as const }}
      />
    </>
  );
};
