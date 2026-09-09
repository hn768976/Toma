import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./hud/constants";
import { HudFrame, type HudFrameProps } from "./hud/HudFrame";

const shared = {
  component: HudFrame,
  durationInFrames: DURATION_IN_FRAMES,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
} as const;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-HUDFrameBlue"
      {...shared}
      defaultProps={{ palette: "blue" } satisfies HudFrameProps}
    />
    <Composition
      id="V2-HUDFrameOverlayCyan"
      {...shared}
      defaultProps={{ palette: "overlayCyan" } satisfies HudFrameProps}
    />
    <Composition
      id="V3-HUDFrameOverlayAmber"
      {...shared}
      defaultProps={{ palette: "overlayAmber" } satisfies HudFrameProps}
    />
  </>
);
