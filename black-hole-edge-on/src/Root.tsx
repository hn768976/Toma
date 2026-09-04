import React from "react";
import { Composition } from "remotion";
import { BlackHole } from "./BlackHole";
import { V1_GOLD, V2_MONO, type Look } from "./presets";

// 15s at 30fps. The loop is built around this number: the shader's time
// uniform is frame / durationInFrames, so changing it re-times the motion
// without breaking the loop.
const FPS = 30;
const DURATION = 450;
const WIDTH = 3840;
const HEIGHT = 2160;

const common = {
  fps: FPS,
  durationInFrames: DURATION,
  width: WIDTH,
  height: HEIGHT,
  component: BlackHole as React.FC<{ look: Look }>,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-BlackHoleEdgeOnGold"
        {...common}
        defaultProps={{ look: V1_GOLD }}
      />
      <Composition
        id="V2-BlackHoleEdgeOnMono"
        {...common}
        defaultProps={{ look: V2_MONO }}
      />
    </>
  );
};
