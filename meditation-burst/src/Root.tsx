import React from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, LOOP, WIDTH } from "./meditation/layout";
import { Meditation } from "./meditation/Meditation";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MeditationGold"
        component={Meditation}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "gold" as const }}
      />
      <Composition
        id="MeditationCool"
        component={Meditation}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "cool" as const }}
      />
      <Composition
        id="MeditationInward"
        component={Meditation}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "inward" as const }}
      />
      {/*
        Verification only. Same component, one frame longer, so frame 600
        can be rendered and compared against frame 0 — see README.
      */}
      <Composition
        id="LoopCheck"
        component={Meditation}
        durationInFrames={LOOP + 1}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "gold" as const }}
      />
    </>
  );
};
