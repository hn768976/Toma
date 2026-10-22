import React from "react";
import { Composition } from "remotion";
import { MonitorScene } from "./monitor/MonitorScene";
import { cameraV1, cameraV2 } from "./monitor/camera";
import { Grade } from "./monitor/renderer";

// 30 fps; 602 frames = 20.067 s, the closest whole-frame match to the 20.053 s reference.
export const FPS = 30;
export const DURATION_IN_FRAMES = 602;
export const WIDTH = 3840;
export const HEIGHT = 2160;

const GRADE: Grade = {
  lift: [0.0, 0.018, 0.022],
  gain: [0.6, 0.8, 0.82],
  bloom: 0.3,
  vignette: 0.6,
  grain: 0.018,
};

const V1 = () => <MonitorScene camera={cameraV1} grade={GRADE} />;
const V2 = () => <MonitorScene camera={cameraV2} grade={GRADE} />;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VitalsMonitor-V1"
        component={V1}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="VitalsMonitor-V2"
        component={V2}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
