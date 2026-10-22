import React from "react";
import { Composition } from "remotion";
import { LocationTrack } from "./track/LocationTrack";
import { STEEL_BLUE, THERMAL_AMBER } from "./track/palette";

// 30 fps; 301 frames = 10.033 s, the closest whole-frame match to the 10.043 s reference.
export const FPS = 30;
export const DURATION_IN_FRAMES = 301;
export const WIDTH = 3840;
export const HEIGHT = 2160;

const V1 = () => <LocationTrack palette={STEEL_BLUE} />;
const V2 = () => <LocationTrack palette={THERMAL_AMBER} />;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LocationTrack-V1"
        component={V1}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="LocationTrack-V2"
        component={V2}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
