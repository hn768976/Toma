import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DURATION_IN_FRAMES } from "./variants";

/** Distinct noise fields cycled over the loop. 270 is divisible by 6, so the
 * grain lands back on its first field exactly at the loop point. */
const SEEDS = 6;

/**
 * Fine film grain, applied as the final 2D layer above the canvas.
 * Rendered by the browser's own turbulence filter, so it costs nothing per
 * frame and is identical on every render for a given frame.
 */
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = (frame % DURATION_IN_FRAMES) % SEEDS;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: 0.06,
        // Overlay modulates what is already there rather than laying a grey
        // haze over the blacks, which is what plain compositing does to a
        // near-black frame.
        mixBlendMode: "overlay",
      }}
    >
      <svg width="100%" height="100%" style={{ display: "block" }}>
        <filter id={`grain-${seed}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves={2}
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
          {/* feTurbulence writes noise into alpha too; force it opaque so the
              grain is an even field rather than a blotchy one. */}
          <feComponentTransfer>
            <feFuncA type="linear" slope="0" intercept="1" />
          </feComponentTransfer>
        </filter>
        <rect
          width="100%"
          height="100%"
          filter={`url(#grain-${seed})`}
        />
      </svg>
    </AbsoluteFill>
  );
};
