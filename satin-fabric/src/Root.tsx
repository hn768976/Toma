import React from "react";
import { Composition } from "remotion";
import { PALETTES } from "./palettes";
import { SatinFabric } from "./SatinFabric";

export const FPS = 30;
export const DURATION_IN_FRAMES = 600; // 20s
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {PALETTES.map((palette) => (
        <Composition
          key={palette.id}
          id={palette.id}
          component={SatinFabric}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ palette }}
        />
      ))}
    </>
  );
};
