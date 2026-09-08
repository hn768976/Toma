import React from "react";
import { Composition } from "remotion";
import {
  DURATION_IN_FRAMES,
  FPS,
  PALETTE_AMBER,
  PALETTE_BLUE,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "./curved-map/constants";
import { CurvedMapDisplay } from "./curved-map/CurvedMapDisplay";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-CurvedMapBlue"
      component={CurvedMapDisplay}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      defaultProps={{ palette: PALETTE_BLUE }}
    />
    <Composition
      id="V2-CurvedMapAmber"
      component={CurvedMapDisplay}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      defaultProps={{ palette: PALETTE_AMBER }}
    />
  </>
);
