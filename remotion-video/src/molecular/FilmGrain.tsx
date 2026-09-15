import React from "react";
import { AbsoluteFill } from "remotion";

/**
 * Per-frame film grain as a DOM layer.
 *
 * Done here rather than as a postprocessing pass so the seed can be driven off
 * the frame number: the grain animates, and it animates identically on a re-run,
 * which a time-based noise shader would not guarantee under distributed
 * rendering.
 */
export const FilmGrain: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  if (opacity <= 0) {
    return null;
  }

  const seed = frame % 97;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves={2}
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
