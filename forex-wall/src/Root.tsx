import React from "react";
import "./load-fonts";
import { Composition } from "remotion";
import {
  DURATION_IN_FRAMES,
  FPS,
  REF_HEIGHT,
  REF_WIDTH,
} from "./constants";
import { ForexWall } from "./ForexWall";
import { DARK, LIGHT } from "./theme";

/**
 * Both compositions are defined at the 4K master size. Render the 1080p
 * preview with --scale=0.5; render the master with --scale=1.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-ForexWallDark"
        component={ForexWall}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={REF_WIDTH}
        height={REF_HEIGHT}
        defaultProps={{ theme: DARK }}
      />
      <Composition
        id="V2-ForexWallLight"
        component={ForexWall}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={REF_WIDTH}
        height={REF_HEIGHT}
        defaultProps={{ theme: LIGHT }}
      />
    </>
  );
};
