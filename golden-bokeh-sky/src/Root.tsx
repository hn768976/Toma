import React from "react";
import { Composition } from "remotion";
import {
  GoldenBokehSky,
  goldenBokehSkySchema,
  type GoldenBokehSkyProps,
} from "./bokeh/GoldenBokehSky";

// 4K UHD master compositions, 30 fps, 28 s (= reference length).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION_IN_FRAMES = 840;

// Palette sampled from the reference footage.
const palette = {
  goldTop: 1.12,
  skyLight: [0.77, 0.894, 0.92],
  skyMid: [0.49, 0.79, 0.867],
  skyDeep: [0.07, 0.55, 0.725],
  warmHi: [0.98, 0.88, 0.56],
  warmMid: [0.86, 0.57, 0.19],
  warmLow: [0.62, 0.34, 0.08],
  haze: [0.93, 0.88, 0.86],
} satisfies Omit<GoldenBokehSkyProps, "camera">;

// Version 1: the reference's slow vertical tilt-up from the warm bokeh to sky.
const v1Props: GoldenBokehSkyProps = { camera: "tilt-up", ...palette };

// Version 2: alternative camera movement - a rising diagonal crane with a
// push-in and roll settle; the bokeh depth layers parallax past each other.
const v2Props: GoldenBokehSkyProps = { camera: "crane-rise", ...palette };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GoldenBokehSky-V1"
        component={GoldenBokehSky}
        schema={goldenBokehSkySchema}
        defaultProps={v1Props}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="GoldenBokehSky-V2"
        component={GoldenBokehSky}
        schema={goldenBokehSkySchema}
        defaultProps={v2Props}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
