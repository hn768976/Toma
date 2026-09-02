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
