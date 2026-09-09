import React from "react";
import { Composition } from "remotion";
import { TVStatic } from "./TVStatic";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-TVStaticMono"
        component={TVStatic}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "mono" as const }}
      />
      <Composition
        id="V2-TVStaticColour"
        component={TVStatic}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "colour" as const }}
      />
    </>
  );
};
