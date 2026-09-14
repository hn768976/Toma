import React from "react";

export type AxisLinesProps = {
  // The plot rectangle the axes frame. The Y axis runs down its left
  // edge (or right edge, for a second scale) and the X axis along the
  // bottom edge.
  x: number;
  y: number;
  width: number;
  height: number;
  which?: "both" | "x" | "y";
  // Y axis on the right-hand edge instead of the left, for the layouts
  // that carry a second value scale.
  side?: "left" | "right";
  // Tick marks are placed to line up with the value/time labels, so pass
  // the same first-offset and step the matching AxisTicks uses.
  yTickOffset?: number;
  yTickStep?: number;
  yTickCount?: number;
  xTickOffset?: number;
  xTickStep?: number;
  xTickCount?: number;
  color?: string;
  strokeWidth?: number;
  tickLength?: number;
  opacity?: number;
};

// The X and Y rules that frame each plot. The background grid alone
// reads as texture; these are the lines that make it read as a chart,
// so they sit a step brighter than the grid and carry tick marks
// registered to the value and time labels.
export const AxisLines: React.FC<AxisLinesProps> = ({
  x,
  y,
  width,
  height,
  which = "both",
  side = "left",
  yTickOffset = 0,
  yTickStep = 0,
  yTickCount = 0,
  xTickOffset = 0,
  xTickStep = 0,
  xTickCount = 0,
  color = "rgba(150, 205, 255, 0.55)",
  strokeWidth = 3,
  tickLength = 14,
  opacity = 1,
}) => {
  const axisX = side === "left" ? x : x + width;
  const tickDirection = side === "left" ? -1 : 1;
  const baselineY = y + height;

  return (
    <g
      opacity={opacity}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="square"
    >
      {which !== "x" ? (
        <>
          <line x1={axisX} y1={y} x2={axisX} y2={baselineY} />
          {Array.from({ length: yTickCount }, (_, i) => {
            const tickY = y + yTickOffset + i * yTickStep;
            if (tickY > baselineY) {
              return null;
            }
            return (
              <line
                key={`y${i}`}
                x1={axisX}
                y1={tickY}
                x2={axisX + tickLength * tickDirection}
                y2={tickY}
                strokeWidth={strokeWidth * 0.75}
              />
            );
          })}
        </>
      ) : null}
      {which !== "y" ? (
        <>
          <line x1={x} y1={baselineY} x2={x + width} y2={baselineY} />
          {Array.from({ length: xTickCount }, (_, i) => {
            const tickX = x + xTickOffset + i * xTickStep;
            if (tickX > x + width) {
              return null;
            }
            return (
              <line
                key={`x${i}`}
                x1={tickX}
                y1={baselineY}
                x2={tickX}
                y2={baselineY + tickLength}
                strokeWidth={strokeWidth * 0.75}
              />
            );
          })}
        </>
      ) : null}
    </g>
  );
};
