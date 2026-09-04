import React from "react";
import { Composition } from "remotion";
import { IrisRing } from "./iris/IrisRing";
import {
  COMP_HEIGHT,
  COMP_WIDTH,
  DURATION_IN_FRAMES,
  FPS,
} from "./iris/field";

// Defined at 4K so the same source renders straight to 3840x2160; the 1080p
// preview is the identical composition at --scale=0.5.
const shared = {
  width: COMP_WIDTH,
  height: COMP_HEIGHT,
  fps: FPS,
  durationInFrames: DURATION_IN_FRAMES,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-IrisRingCyan"
        component={IrisRing}
        {...shared}
        defaultProps={{ paletteId: "cyan", seed: 20260904 }}
      />
      <Composition
        id="V2-IrisRingGold"
        component={IrisRing}
        {...shared}
        defaultProps={{ paletteId: "gold", seed: 771103 }}
      />
      <Composition
        id="V3-IrisRingViolet"
        component={IrisRing}
        {...shared}
        defaultProps={{ paletteId: "violet", seed: 4820551 }}
      />
    </>
  );
};
