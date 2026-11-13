import React from "react";
import { Composition } from "remotion";
import { CircuitScene, CircuitSceneProps } from "./CircuitScene";
import { CAM_CPU_REFERENCE } from "./engine/camera";
import { EMBER_GOLD, NAVY_CYAN } from "./engine/palettes";

// 4K UHD master. Deliver 1080p with `--scale=0.5`.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
// Reference clip: 10.04 s. 301 frames @ 30 fps = 10.033 s (closest whole frame).
export const DURATION_IN_FRAMES = 301;

// V1 follows the reference clip. V2 keeps the same shot and swaps the colour palette.
const v1: CircuitSceneProps = { variant: "cpu", palette: NAVY_CYAN, camera: CAM_CPU_REFERENCE };
const v2: CircuitSceneProps = { variant: "cpu", palette: EMBER_GOLD, camera: CAM_CPU_REFERENCE };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="CpuActivation-V1-Reference" component={CircuitScene} defaultProps={v1} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={DURATION_IN_FRAMES} />
      <Composition id="CpuActivation-V2-EmberGold" component={CircuitScene} defaultProps={v2} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={DURATION_IN_FRAMES} />
    </>
  );
};
