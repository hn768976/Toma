import React from "react";
import { Composition } from "remotion";

import { GlitchCanvas } from "./GlitchCanvas";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  FPS,
  VARIANTS,
  durationInFrames,
} from "./variants";

/**
 * Two compositions per variant. The 4K one is the master — it is the same
 * composition, sampled twice as finely — and the 1080p one is the delivery
 * render. Both are 30fps and run the length of the reference they answer to.
 */
export const GlitchCompositions: React.FC = () => (
  <>
    {VARIANTS.flatMap((variant) =>
      (
        [
          ["4K", BASE_WIDTH * 2, BASE_HEIGHT * 2],
          ["1080p", BASE_WIDTH, BASE_HEIGHT],
        ] as const
      ).map(([suffix, width, height]) => (
        <Composition
          key={`${variant.id}-${suffix}`}
          id={`Glitch-${variant.id}-${suffix}`}
          component={GlitchCanvas}
          durationInFrames={durationInFrames(variant)}
          fps={FPS}
          width={width}
          height={height}
          defaultProps={{ variantId: variant.id }}
        />
      )),
    )}
  </>
);
