import React from "react";
import { Composition } from "remotion";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  DURATION_IN_FRAMES,
  FPS,
} from "./hud/constants";
import { HUDPlane, hudPlaneDefaults } from "./hud/HUDPlane";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-HUDPlaneBlue"
        component={HUDPlane}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        defaultProps={{ ...hudPlaneDefaults, paletteName: "blue" as const }}
      />
      <Composition
        id="V2-HUDPlaneAmber"
        component={HUDPlane}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        defaultProps={{ ...hudPlaneDefaults, paletteName: "amber" as const }}
      />
    </>
  );
};
