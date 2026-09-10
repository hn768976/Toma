import React from "react";
import { Composition } from "remotion";
import { SecurityAlert } from "./SecurityAlert";
import { VIDEO } from "./theme";

/**
 * Both compositions are defined at 3840x2160. Preview renders pass
 * `--scale=0.5` for 1080p; the 4K deliverable is the same id at
 * `--scale=1`.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="SecurityBreach"
      component={SecurityAlert}
      durationInFrames={VIDEO.durationInFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{ outcome: "breach" as const }}
    />
    <Composition
      id="AccessGranted"
      component={SecurityAlert}
      durationInFrames={VIDEO.durationInFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{ outcome: "granted" as const }}
    />
  </>
);
