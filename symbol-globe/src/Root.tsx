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
    </>
  );
};
