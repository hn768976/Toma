import React from "react";
import { Composition } from "remotion";
import { HairRepair } from "./HairRepair";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 – matches the reference: warm olive / amber palette. */}
      <Composition
        id="HairRepairV1"
        component={HairRepair}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "reference" as const }}
      />
      {/* Version 2 – same animation in a cool sapphire / ice palette. */}
      <Composition
        id="HairRepairV2"
        component={HairRepair}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "sapphire" as const }}
      />
    </>
  );
};
