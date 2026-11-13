import React from "react";
import { Composition } from "remotion";
import { RadarHologram } from "./RadarHologram";
import { DURATION_FRAMES, FPS } from "./scene/buildScene";

// Both compositions are authored at 4K UHD. Render with --scale=0.5 for 1080p.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="RadarHologram-V1"
        component={RadarHologram}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="RadarHologram-V2"
        component={RadarHologram}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
