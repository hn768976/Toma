import React from "react";
import { Composition } from "remotion";
import { CausticPool, causticPoolSchema } from "./CausticPool";
import { FPS, HEIGHT, PALETTES, WIDTH, DURATION_IN_FRAMES } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 - matches the reference clip (cyan / pool blue). */}
      <Composition
        id="CausticPool-V1-Reference"
        component={CausticPool}
        schema={causticPoolSchema}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: PALETTES.poolBlue, grain: 0.004 }}
      />
      {/* Version 2 - identical motion, alternative "emerald lagoon" palette. */}
      <Composition
        id="CausticPool-V2-EmeraldLagoon"
        component={CausticPool}
        schema={causticPoolSchema}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: PALETTES.emeraldLagoon, grain: 0.004 }}
      />
    </>
  );
};
