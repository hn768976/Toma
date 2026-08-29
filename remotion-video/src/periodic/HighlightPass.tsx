import React, { useMemo } from "react";
import { CELL_SIZE, PLACED_ELEMENTS } from "./layout";
import { buildTimings, highlightIntensity } from "./motion";
import { glowGradientId } from "./ElementCell";
import type { Variant } from "./variants";

const HALO_SCALE = 2.6;
const PASS_STRENGTH = 0.4;

/**
 * An additive glow pass over the currently emphasised cells. The "assemble"
 * variant has no category highlighting, so it renders nothing.
 */
export const HighlightPass: React.FC<{
  variant: Variant;
  frame: number;
}> = ({ variant, frame }) => {
  const timings = useMemo(() => buildTimings(variant), [variant]);
  const paints = useMemo(
    () => PLACED_ELEMENTS.map((element) => variant.paintFor(element)),
    [variant],
  );

  if (variant.highlight.mode === "none") {
    return null;
  }

  const { dimTo } = variant.highlight;
  const haloSize = CELL_SIZE * HALO_SCALE;

  return (
    <g>
      {PLACED_ELEMENTS.map((element, index) => {
        if (frame < timings[index].land) {
          return null;
        }
        const intensity = highlightIntensity(variant, frame, element.category);
        const lift = (intensity - dimTo) / (1 - dimTo);
        if (lift <= 0.01) {
          return null;
        }
        return (
          <rect
            key={element.atomicNumber}
            x={element.cx - haloSize / 2}
            y={element.cy - haloSize / 2}
            width={haloSize}
            height={haloSize}
            fill={`url(#${glowGradientId(paints[index].glow)})`}
            opacity={lift * PASS_STRENGTH}
          />
        );
      })}
    </g>
  );
};
