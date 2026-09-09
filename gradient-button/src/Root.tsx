import React from "react";
import { Composition } from "remotion";
import { GradientButton } from "./GradientButton";
import { DARK_COOL, DARK_SPECTRUM, LIGHT_SPECTRUM } from "./theme";

/**
 * Compositions are authored at 3840x2160 so they can be rendered at 4K.
 * Render 1080p previews with `--scale=0.5`; every size in the component is a
 * fraction of the frame, so the two are the same picture.
 */
const FORMAT = {
  width: 3840,
  height: 2160,
  fps: 30,
  durationInFrames: 600, // 20s, an exact whole number of highlight laps
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-GradientButtonSpectrum"
        component={GradientButton}
        {...FORMAT}
        defaultProps={{ theme: DARK_SPECTRUM, uid: "v1" }}
      />
      <Composition
        id="V2-GradientButtonCyan"
        component={GradientButton}
        {...FORMAT}
        defaultProps={{ theme: DARK_COOL, uid: "v2" }}
      />
      <Composition
        id="V3-GradientButtonLight"
        component={GradientButton}
        {...FORMAT}
        defaultProps={{ theme: LIGHT_SPECTRUM, uid: "v3" }}
      />
    </>
  );
};
