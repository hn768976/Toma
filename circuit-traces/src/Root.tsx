import React from "react";
import { Composition } from "remotion";
import { CircuitBoard } from "./circuit/CircuitBoard";
import { BASE_H, BASE_W, DURATION_IN_FRAMES, FPS } from "./circuit/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-CircuitNeon"
        component={CircuitBoard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_W}
        height={BASE_H}
        defaultProps={{ variant: "neon" as const }}
      />
      <Composition
        id="V2-CircuitAmber"
        component={CircuitBoard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_W}
        height={BASE_H}
        defaultProps={{ variant: "amber" as const }}
      />
    </>
  );
};
