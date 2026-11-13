import React from "react";
import { Composition } from "remotion";
import { CircuitScene, CircuitSceneProps } from "./CircuitScene";
import { CAM_LOCK_ORBIT, CAM_LOCK_REFERENCE } from "./engine/camera";
import { ELECTRIC_BLUE } from "./engine/palettes";

// 4K UHD master. Deliver 1080p with `--scale=0.5`.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
// Reference clip: 10.04 s. 301 frames @ 30 fps = 10.033 s (closest whole frame).
export const DURATION_IN_FRAMES = 301;

// V1 follows the reference clip. V2 keeps the palette and changes the camera move:
// a bird's-eye spiral descent that ends on a three-quarter orbit of the padlock.
const v1: CircuitSceneProps = { variant: "lock", palette: ELECTRIC_BLUE, camera: CAM_LOCK_REFERENCE, lockYaw: 0 };
const v2: CircuitSceneProps = { variant: "lock", palette: ELECTRIC_BLUE, camera: CAM_LOCK_ORBIT, lockYaw: 30 };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="PadlockSecurity-V1-Reference" component={CircuitScene} defaultProps={v1} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={DURATION_IN_FRAMES} />
      <Composition id="PadlockSecurity-V2-OrbitCamera" component={CircuitScene} defaultProps={v2} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={DURATION_IN_FRAMES} />
    </>
  );
};
