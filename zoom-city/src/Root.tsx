import React from "react";
import { Composition } from "remotion";
import { ZoomCity } from "./zoom-city/ZoomCity";
import { FPS, HEIGHT, LOOP_FRAMES, WIDTH } from "./zoom-city/geometry";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ZoomCityViolet"
        component={ZoomCity}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "violet" as const }}
      />
      <Composition
        id="ZoomCityAmber"
        component={ZoomCity}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "amber" as const }}
      />
      <Composition
        id="ZoomCityMono"
        component={ZoomCity}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "mono" as const }}
      />
    </>
  );
};
