import React from "react";
import { Composition } from "remotion";
import { CircuitBoard } from "./circuit/CircuitBoard";

/** Defined at 4K so the same compositions render at 3840x2160 with --scale=1. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 480; // 16s, seamless

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-CircuitNeon"
      component={CircuitBoard}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "neon" as const }}
    />
    <Composition
      id="V2-CircuitAmber"
      component={CircuitBoard}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "amber" as const }}
    />
  </>
);
