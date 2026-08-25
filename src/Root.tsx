import React from "react";
import { Composition } from "remotion";
import { CandleChart } from "./CandleChart";
import { DURATION, FPS, HEIGHT, WIDTH } from "./config";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CandleChart"
        component={CandleChart}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      {/*
        Same shot, one frame longer, purely so the loop can be proved:
        frame DURATION is the seam and must be pixel-identical to frame 0.
        See `npm run verify:loop`.
      */}
      <Composition
        id="CandleChartLoopCheck"
        component={CandleChart}
        durationInFrames={DURATION + 1}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
