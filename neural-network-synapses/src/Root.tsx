import React from "react";
import { Composition } from "remotion";
import { NeuralNetworkV1, NeuralNetworkV2 } from "./NeuralNetwork";

// 4K masters. The reference clip is 401 frames at 30 fps (13.367 s).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION_IN_FRAMES = 401;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NeuralNetwork-V1-Reference"
        component={NeuralNetworkV1}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
      />
      <Composition
        id="NeuralNetwork-V2-EmberPalette"
        component={NeuralNetworkV2}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
      />
    </>
  );
};
