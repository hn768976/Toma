import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import type { Layout } from "../layout";
import type { Theme } from "../theme";
import { AXIS_WIPE } from "../timing";

/**
 * Both axes are dashed lines that wipe out of the origin — the Y axis upward,
 * the X axis to the right. The wipe moves the line's end point rather than
 * masking a finished line, so the dash pattern stays anchored at the origin and
 * dashes appear one after another.
 */
export const Axes: React.FC<{ layout: Layout; theme: Theme }> = ({
  layout,
  theme,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [AXIS_WIPE.start, AXIS_WIPE.end],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const stroke = {
    stroke: theme.ink,
    strokeOpacity: theme.alpha.axis,
    strokeWidth: layout.axisWidth,
    strokeDasharray: `${layout.axisDash} ${layout.axisGap}`,
  };

  const yEnd = layout.baselineY + (layout.axisTopY - layout.baselineY) * progress;
  const xEnd = layout.axisX + (layout.plotRightX - layout.axisX) * progress;

  return (
    <g>
      <line
        x1={layout.axisX}
        y1={layout.baselineY}
        x2={layout.axisX}
        y2={yEnd}
        {...stroke}
      />
      <line
        x1={layout.axisX}
        y1={layout.baselineY}
        x2={xEnd}
        y2={layout.baselineY}
        {...stroke}
      />
    </g>
  );
};
