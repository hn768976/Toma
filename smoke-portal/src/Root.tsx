import React from "react";
import { Composition } from "remotion";
import {
  SmokePortal,
  smokePortalSchema,
  smokePortalV1,
  smokePortalV2,
} from "./SmokePortal";

/** 4K UHD master resolution. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** Reference clip: 301 frames (10.04 s). */
export const DURATION_IN_FRAMES = 301;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SmokePortalV1"
        component={SmokePortal}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={smokePortalSchema}
        defaultProps={smokePortalV1}
      />
      <Composition
        id="SmokePortalV2"
        component={SmokePortal}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={smokePortalSchema}
        defaultProps={smokePortalV2}
      />
    </>
  );
};
