import React from "react";
import { Composition } from "remotion";
import { CorruptedScreen } from "./CorruptedScreen";
import { GREEN_THEME, RED_THEME } from "./lib/theme";
import { DURATION_IN_FRAMES, FPS } from "./lib/timing";
import "./loadFonts";

/**
 * Defined at 3840x2160 so the same source renders at 4K. Preview renders pass
 * --scale=0.5 for a 1920x1080 mp4; everything is sized as a fraction of the
 * frame, so the two match.
 */
const MASTER = { width: 3840, height: 2160, fps: FPS, durationInFrames: DURATION_IN_FRAMES };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-CorruptedScreenRed"
        component={CorruptedScreen}
        {...MASTER}
        defaultProps={{ theme: RED_THEME, showMessage: true }}
      />
      <Composition
        id="V2-CorruptedScreenGreen"
        component={CorruptedScreen}
        {...MASTER}
        defaultProps={{ theme: GREEN_THEME, showMessage: true }}
      />
      <Composition
        id="V3-CorruptedScreenPlate"
        component={CorruptedScreen}
        {...MASTER}
        defaultProps={{ theme: RED_THEME, showMessage: false }}
      />
    </>
  );
};
