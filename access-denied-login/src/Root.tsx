import React from "react";
import { Composition } from "remotion";
import { AccessDenied, AccessDeniedProps } from "./AccessDenied/AccessDenied";
import { DURATION_FRAMES, FPS } from "./AccessDenied/scene";

// Both compositions are authored natively in 4K UHD (3840x2160) at 30 fps.
// Duration = 622 frames = 20.733 s, identical to the reference clip.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-AccessDenied-Original"
        component={AccessDenied}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v1", renderScale: 1 } satisfies AccessDeniedProps}
      />
      <Composition
        id="V2-AccessDenied-LowAngleOrbit"
        component={AccessDenied}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v2", renderScale: 1 } satisfies AccessDeniedProps}
      />
    </>
  );
};
