import React from "react";
import { Composition } from "remotion";
import { CircuitChip, type ChipProps } from "./CircuitChip";

export const FPS = 30;
export const DURATION = 600; // 20s, seamless loop
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-CircuitChipBlue"
      component={CircuitChip}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "blue", seed: 20481 } satisfies ChipProps}
    />
    <Composition
      id="V2-CircuitChipAmber"
      component={CircuitChip}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "amber", seed: 77341 } satisfies ChipProps}
    />
  </>
);
