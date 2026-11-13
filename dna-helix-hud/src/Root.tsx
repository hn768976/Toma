import React from "react";
import { Composition } from "remotion";
import { DnaHelixHud, dnaSchema } from "./DnaHelixHud";

// 4K masters. Deliverables are rendered from these at --scale=0.5 (1080p).
const FPS = 30;
const DURATION = 600; // 20.000 s, identical to the reference clip
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DnaHelixHUD-V1-Reference"
        component={DnaHelixHud}
        schema={dnaSchema}
        defaultProps={{ variant: "reference" as const }}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="DnaHelixHUD-V2-OrbitCamera"
        component={DnaHelixHud}
        schema={dnaSchema}
        defaultProps={{ variant: "orbit" as const }}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
