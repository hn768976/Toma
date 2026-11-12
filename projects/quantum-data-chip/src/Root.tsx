import React from "react";
import { Composition } from "remotion";
import { QuantumDataChip } from "./QuantumDataChip";

// Authored at 4K UHD. The reference clip is 301 frames @ 30 fps (10.033 s).
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION = 301;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="QuantumDataChip-V1"
      component={QuantumDataChip}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "v1" as const }}
    />
    <Composition
      id="QuantumDataChip-V2"
      component={QuantumDataChip}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "v2" as const }}
    />
  </>
);
