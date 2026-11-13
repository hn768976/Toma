import React from "react";
import { Composition } from "remotion";
import { CircuitBoardV1, CircuitBoardV2 } from "./CircuitBoard";

// 4K UHD master compositions. Render with `--scale=0.5` for 1080p delivery.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION = 300; // 10.000 s, same length as the reference clip

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CircuitBoard-V1-Reference-4K"
        component={CircuitBoardV1}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="CircuitBoard-V2-ColorPalette-4K"
        component={CircuitBoardV2}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
