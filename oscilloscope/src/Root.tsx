import React from "react";
import { Composition } from "remotion";
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  DURATION_IN_FRAMES,
  FPS,
} from "./constants";
import { Oscilloscope } from "./Oscilloscope";
import { V1, V2 } from "./theme";

/**
 * Both compositions are defined at full 4K. Render a 1080p preview with
 * `--scale=0.5`; render the deliverable with `--scale=1`.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-ScopeMulticolour"
      component={Oscilloscope}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={DESIGN_WIDTH}
      height={DESIGN_HEIGHT}
      defaultProps={{ theme: V1 }}
    />
    <Composition
      id="V2-ScopeGreenPhosphor"
      component={Oscilloscope}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={DESIGN_WIDTH}
      height={DESIGN_HEIGHT}
      defaultProps={{ theme: V2 }}
    />
  </>
);
