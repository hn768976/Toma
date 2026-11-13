import React from "react";
import { Composition } from "remotion";
import { ClockMacro } from "./ClockMacro";

export const FPS = 30;
// Reference clip: 749 frames @ 25 fps = 29.96 s → 899 frames @ 30 fps.
export const DURATION_FRAMES = 899;

// Both compositions are authored at 4K UHD. Render with --scale=0.5 for 1080p.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ClockMacro-V1"
        component={ClockMacro}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="ClockMacro-V2"
        component={ClockMacro}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
