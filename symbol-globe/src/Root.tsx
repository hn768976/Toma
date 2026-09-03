import React from "react";
import { Composition } from "remotion";
import { SymbolGlobe } from "./SymbolGlobe";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./config";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GlobeQuestion"
        component={SymbolGlobe}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "question" as const }}
      />
      {/* TEMPORARY loop-closure probe: 451 frames, but still a 450-frame loop,
          so frame 450 can be rendered and compared against frame 0. */}
      <Composition
        id="LoopCheck"
        component={SymbolGlobe}
        durationInFrames={DURATION_IN_FRAMES + 1}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          variant: "question" as const,
          loopLength: DURATION_IN_FRAMES,
        }}
      />
    </>
  );
};
