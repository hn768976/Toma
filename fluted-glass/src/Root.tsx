import React from "react";
import { Composition } from "remotion";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./fluted-glass/constants";
import { FlutedGlass, flutedGlassSchema } from "./fluted-glass/FlutedGlass";

// All three versions are the same motion; only the palette differs.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-FlutedGlassBlue"
        component={FlutedGlass}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={flutedGlassSchema}
        defaultProps={{ palette: "blue" as const }}
      />
      <Composition
        id="V2-FlutedGlassGold"
        component={FlutedGlass}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={flutedGlassSchema}
        defaultProps={{ palette: "gold" as const }}
      />
      <Composition
        id="V3-FlutedGlassMono"
        component={FlutedGlass}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={flutedGlassSchema}
        defaultProps={{ palette: "mono" as const }}
      />
    </>
  );
};
