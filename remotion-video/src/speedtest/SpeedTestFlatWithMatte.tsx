import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { DURATION_IN_FRAMES } from "./constants";
import { SpeedTestFlat } from "./SpeedTestFlat";

/**
 * Stock-delivery layout of the flat version: the 10s colour pass, then the same
 * 10s again as a white-on-black luma matte, so an editor can key the board over
 * their own background without an alpha codec.
 */
export const SpeedTestFlatWithMatte: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={DURATION_IN_FRAMES}>
      <SpeedTestFlat />
    </Sequence>
    <Sequence from={DURATION_IN_FRAMES} durationInFrames={DURATION_IN_FRAMES}>
      <SpeedTestFlat matte />
    </Sequence>
  </AbsoluteFill>
);
