import React from "react";
import { Composition } from "remotion";
import { EnergyBeam } from "./beam/EnergyBeam";
import { ICE_BLUE, SOLAR_AMBER } from "./beam/palettes";

// Reference clip: 22.416667 s. At 30 fps that is 672.5 frames; 673 frames
// (22.433 s) is the closest whole-frame length that does not cut content short.
const FPS = 30;
const DURATION_IN_FRAMES = 673;

// Compositions are authored in 4K UHD. Deliverables are rendered at 1080p
// with `--scale=0.5` (see README).
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EnergyBeam-V1-4K"
        component={EnergyBeam}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: ICE_BLUE }}
      />
      <Composition
        id="EnergyBeam-V2-4K"
        component={EnergyBeam}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: SOLAR_AMBER }}
      />
    </>
  );
};
