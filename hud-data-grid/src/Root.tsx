import React from "react";
import { Composition } from "remotion";
import { HudDataGrid } from "./HudDataGrid";

// Both compositions are authored at 3840x2160 (4K UHD), 30 fps.
// The reference clip is exactly 20.000 s -> 600 frames.
export const FPS = 30;
export const DURATION = 600;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HudDataGrid-V1-Reference"
        component={HudDataGrid}
        fps={FPS}
        durationInFrames={DURATION}
        width={3840}
        height={2160}
        defaultProps={{ variant: "reference" as const }}
      />
      <Composition
        id="HudDataGrid-V2-CraneMove"
        component={HudDataGrid}
        fps={FPS}
        durationInFrames={DURATION}
        width={3840}
        height={2160}
        defaultProps={{ variant: "craneMove" as const }}
      />
    </>
  );
};
