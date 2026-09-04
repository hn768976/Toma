import React from "react";
import { Composition } from "remotion";
import { Canopy } from "./Canopy";
import { BLUE_NIGHT, MONO_FOG } from "./palette";

/**
 * Both versions are defined at 4K so they can be rendered at full size later;
 * the previews in this repo are simply the same compositions rendered with
 * --scale=0.5.
 */
const SHARED = {
  width: 3840,
  height: 2160,
  fps: 30,
  durationInFrames: 600,
} as const;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-CanopyMonoFog"
      component={Canopy}
      defaultProps={{ palette: MONO_FOG }}
      {...SHARED}
    />
    <Composition
      id="V2-CanopyBlueNight"
      component={Canopy}
      defaultProps={{ palette: BLUE_NIGHT }}
      {...SHARED}
    />
  </>
);
