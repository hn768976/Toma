import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS } from "./scene/timeline";
import { SerumDrop } from "./SerumDrop";

// Both compositions are authored in 4K UHD (3840x2160) at 30 fps.
// Render with `--scale=0.5` for the 1080p deliverables.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SerumDrop-V1"
        component={SerumDrop}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="SerumDrop-V2"
        component={SerumDrop}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
