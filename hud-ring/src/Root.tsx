import React from "react";
import { Composition } from "remotion";
import { HudRing, hudRingDefaults } from "./hud/HudRing";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./hud/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-HUDRingCyan"
        component={HudRing}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ ...hudRingDefaults, palette: "cyan" as const }}
      />
      <Composition
        id="V2-HUDRingAlert"
        component={HudRing}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ ...hudRingDefaults, palette: "alert" as const }}
      />
    </>
  );
};
