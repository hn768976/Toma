import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { MONTHS, Y_MAX } from "../data";
import type { Layout } from "../layout";
import type { Theme } from "../theme";
import { GRID } from "../timing";

const HORIZONTAL_VALUES = Array.from(
  { length: Y_MAX / 100 },
  (_, i) => (i + 1) * 100,
);

/**
 * Vertical rules at each month, drawing downward from the top of the plot and
 * staggered left to right, with the faint horizontals cross-fading in behind.
 */
export const Grid: React.FC<{ layout: Layout; theme: Theme }> = ({
  layout,
  theme,
}) => {
  const frame = useCurrentFrame();
  const stagger =
    (GRID.end - GRID.draw - GRID.start) / Math.max(1, MONTHS.length - 1);

  return (
    <g>
      {HORIZONTAL_VALUES.map((value, i) => {
        const start = GRID.horizontalStart + i * 1.5;
        const opacity = interpolate(
          frame,
          [start, start + GRID.horizontalFade],
          [0, theme.alpha.gridHorizontal],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const y = layout.valueToY(value);
        return (
          <line
            key={value}
            x1={layout.axisX}
            y1={y}
            x2={layout.plotRightX}
            y2={y}
            stroke={theme.ink}
            strokeOpacity={opacity}
            strokeWidth={layout.gridWidth}
          />
        );
      })}

      {MONTHS.map((month, i) => {
        const start = GRID.start + i * stagger;
        const progress = interpolate(
          frame,
          [start, start + GRID.draw],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const x = layout.monthToX(i);
        return (
          <line
            key={month}
            x1={x}
            y1={layout.gridTopY}
            x2={x}
            y2={
              layout.gridTopY + (layout.baselineY - layout.gridTopY) * progress
            }
            stroke={theme.ink}
            strokeOpacity={theme.alpha.gridVertical}
            strokeWidth={layout.gridWidth}
          />
        );
      })}
    </g>
  );
};
