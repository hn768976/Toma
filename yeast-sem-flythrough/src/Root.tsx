import React from "react";
import { Composition } from "remotion";
import { ThreeStage } from "./engine/ThreeStage";
import { yeastFactory, YeastParams } from "./scene/yeast";

// Reference clip: 10.0 s -> 300 frames at 30 fps.
const FPS = 30;
const DURATION = 300;
const WIDTH = 3840;
const HEIGHT = 2160;

const V1: YeastParams = { camera: "flythrough" };
const V2: YeastParams = { camera: "orbit-pullback" };

const Version1: React.FC = () => (
  <ThreeStage factory={yeastFactory} params={V1} />
);
const Version2: React.FC = () => (
  <ThreeStage factory={yeastFactory} params={V2} />
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="YeastSEM-V1-ReferenceMatch"
        component={Version1}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="YeastSEM-V2-OrbitPullBack"
        component={Version2}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
