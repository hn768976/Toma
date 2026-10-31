import React from "react";
import { Composition } from "remotion";
import { RippleSurface, rippleSurfaceSchema } from "./RippleSurface";
import { CAMERA, DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 - matches the reference: top-down view of the surface. */}
      <Composition
        id="RippleSurface-V1-Reference"
        component={RippleSurface}
        schema={rippleSurfaceSchema}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ cameraMode: CAMERA.topDown, grain: 0.004 }}
      />
      {/* Version 2 - same water, low-angle perspective camera, dolly + pan. */}
      <Composition
        id="RippleSurface-V2-LowAngleDolly"
        component={RippleSurface}
        schema={rippleSurfaceSchema}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ cameraMode: CAMERA.lowAngleDolly, grain: 0.004 }}
      />
    </>
  );
};
