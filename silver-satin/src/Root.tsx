import React from "react";
import { Composition } from "remotion";
import {
  LOW_ANGLE_PROPS,
  REFERENCE_PROPS,
  SilverSatin,
  satinSchema,
} from "./SilverSatin";

// 4K UHD, 30 fps. 401 frames = the reference clip's exact frame count
// (13.367 s at 30 fps vs. the reference's 13.380 s at 29.97 fps).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION_IN_FRAMES = 401;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SilverSatin-V1-Reference"
        component={SilverSatin}
        schema={satinSchema}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={REFERENCE_PROPS}
      />
      <Composition
        id="SilverSatin-V2-LowAngleDolly"
        component={SilverSatin}
        schema={satinSchema}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={LOW_ANGLE_PROPS}
      />
    </>
  );
};
