import React from "react";
import { Composition } from "remotion";
import { BreathingRing, breathingRingSchema } from "./BreathingRing";
import {
  BOX_4_4_4_4,
  COHERENT_5_5,
  RELAXING_4_7_8,
  cycleDurationInFrames,
  type BreathingPattern,
} from "./patterns";

/** Composition size. Render 1080p previews with `--scale=0.5`. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

const defaults = (pattern: BreathingPattern) => ({
  pattern,
  // No text in the default renders. Flip to true for a labelled variant.
  showPhaseLabels: false,
  showEchoRings: true,
  grainOpacity: 0.02,
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* V1 — Box breathing 4-4-4-4. 16s = 480 frames. */}
      <Composition
        id="V1-BreathingBox4444"
        component={BreathingRing}
        durationInFrames={cycleDurationInFrames(BOX_4_4_4_4, FPS)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={breathingRingSchema}
        defaultProps={defaults(BOX_4_4_4_4)}
      />
      {/* V2 — 4-7-8. 19s = 570 frames. */}
      <Composition
        id="V2-Breathing478"
        component={BreathingRing}
        durationInFrames={cycleDurationInFrames(RELAXING_4_7_8, FPS)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={breathingRingSchema}
        defaultProps={defaults(RELAXING_4_7_8)}
      />
      {/* V3 — Coherent breathing 5.5-5.5. 11s = 330 frames. */}
      <Composition
        id="V3-BreathingCoherent55"
        component={BreathingRing}
        durationInFrames={cycleDurationInFrames(COHERENT_5_5, FPS)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={breathingRingSchema}
        defaultProps={defaults(COHERENT_5_5)}
      />
    </>
  );
};
