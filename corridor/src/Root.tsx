import React from "react";
import { Composition } from "remotion";
import { Corridor } from "./Corridor";
import { FPS, LOOP_FRAMES, VIDEO_HEIGHT, VIDEO_WIDTH } from "./variants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CorridorFibre"
        component={Corridor}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{ variant: "fibre" as const }}
      />
      <Composition
        id="CorridorSlab"
        component={Corridor}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{ variant: "slab" as const }}
      />
    </>
  );
};
