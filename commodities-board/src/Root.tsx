import React from "react";
import { Composition } from "remotion";
import { CommoditiesBoard } from "./CommoditiesBoard";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

/**
 * Both compositions are defined at 3840x2160 so they can be rendered at 4K.
 * Render a 1080p preview with --scale=0.5.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-CommoditiesBoardDark"
      component={CommoditiesBoard}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ theme: "dark" as const }}
    />
    <Composition
      id="V2-CommoditiesBoardLight"
      component={CommoditiesBoard}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ theme: "light" as const }}
    />
  </>
);
