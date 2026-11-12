import React from "react";
import { Composition } from "remotion";
import { ThreeStage } from "./engine/ThreeStage";
import { CYAN_AMBER, MONO } from "./cubes/palette";
import { DataCubesProps, dataCubesFactory } from "./cubes/scene";

// 4K masters. Deliverables are rendered from these with `--scale=0.5`
// (1920x1080); `--scale=1` renders the native 3840x2160 frames.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION = 900; // 30.000 s — identical to the reference clip

const v1: DataCubesProps = { palette: MONO };
const v2: DataCubesProps = { palette: CYAN_AMBER };

const DataCubesV1: React.FC = () => (
  <ThreeStage factory={dataCubesFactory} sceneProps={v1} background={MONO.css} />
);
const DataCubesV2: React.FC = () => (
  <ThreeStage factory={dataCubesFactory} sceneProps={v2} background={CYAN_AMBER.css} />
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="DataCubes-V1-Reference"
      component={DataCubesV1}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={DURATION}
    />
    <Composition
      id="DataCubes-V2-CyanAmber"
      component={DataCubesV2}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={DURATION}
    />
  </>
);
