import React from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, LOOP, WIDTH } from "./constants";
import { HudDash } from "./HudDash";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HudDashBlue"
        component={HudDash}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
      <Composition
        id="HudDashAmber"
        component={HudDash}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "amber" as const }}
      />
    </>
  );
};
