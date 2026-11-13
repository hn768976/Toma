import React from "react";
import { Composition } from "remotion";
import { FinanceDashboard } from "./FinanceDashboard";

// Both compositions are authored at 3840x2160 (4K UHD), 30 fps.
// The reference clip is 10.01 s at 23.976 fps (240 frames). At 30 fps the
// closest whole-frame length is 300 frames = 10.000 s (10.01 s would be 300.3 frames).
export const FPS = 30;
export const DURATION = 300;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FinanceDashboard-V1-Reference"
        component={FinanceDashboard}
        fps={FPS}
        durationInFrames={DURATION}
        width={3840}
        height={2160}
        defaultProps={{ variant: "reference" as const }}
      />
      <Composition
        id="FinanceDashboard-V2-EmeraldGold"
        component={FinanceDashboard}
        fps={FPS}
        durationInFrames={DURATION}
        width={3840}
        height={2160}
        defaultProps={{ variant: "emerald" as const }}
      />
    </>
  );
};
