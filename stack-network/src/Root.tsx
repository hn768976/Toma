import React from "react";
import { Composition } from "remotion";
import { StackNetwork } from "./StackNetwork";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./lib/constants";


/**
 * Both versions are the same component. Only the theme, the node list and
 * the routing style differ -- see src/scenes/.
 *
 * Registered at 3840x2160 so `--scale=1` renders a 4K master; the 1080p
 * previews are the same compositions at `--scale=0.5`.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-StackNetworkWarm"
      component={StackNetwork}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "warm" as const }}
    />
    <Composition
      id="V2-StackNetworkViolet"
      component={StackNetwork}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "violet" as const }}
    />
  </>
);
