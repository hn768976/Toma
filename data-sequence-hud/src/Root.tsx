import React from "react";
import { Composition } from "remotion";
import { DataSequenceHud, hudSchema } from "./DataSequenceHud";

// 4K masters. Deliverables are rendered from these at --scale=0.5 (1080p).
const FPS = 30;
const DURATION = 600; // 20.000 s, identical to the reference clip
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DataSequenceHUD-V1-Reference"
        component={DataSequenceHud}
        schema={hudSchema}
        defaultProps={{ palette: "reference" as const }}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="DataSequenceHUD-V2-NeonPalette"
        component={DataSequenceHud}
        schema={hudSchema}
        defaultProps={{ palette: "neon" as const }}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
