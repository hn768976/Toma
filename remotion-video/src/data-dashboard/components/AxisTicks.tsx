import React from "react";
import { FONT_MONO } from "../constants";
import { formatMoney } from "../series";

export type AxisTicksProps = {
  x: number;
  y: number;
  // Vertical distance between ticks (vertical axis) or horizontal
  // distance between labels (horizontal axis).
  step: number;
  count: number;
  from: number;
  increment: number;
  orientation?: "vertical" | "horizontal";
  anchor?: "start" | "middle" | "end";
  fontSize?: number;
  color?: string;
  decimals?: number;
  opacity?: number;
  labels?: string[];
};

// The columns and strips of monospaced numbers that frame every panel.
// Pass `labels` to print literal strings (years, quarters) instead of a
// generated numeric ramp.
export const AxisTicks: React.FC<AxisTicksProps> = ({
  x,
  y,
  step,
  count,
  from,
  increment,
  orientation = "vertical",
  anchor = "end",
  fontSize = 20,
  color = "rgba(150, 205, 255, 0.72)",
  decimals = 2,
  opacity = 1,
  labels,
}) => (
  <g
    opacity={opacity}
    fill={color}
    fontFamily={FONT_MONO}
    fontSize={fontSize}
    fontWeight={400}
    textAnchor={anchor}
    letterSpacing={fontSize * 0.02}
  >
    {Array.from({ length: count }, (_, i) => (
      <text
        key={i}
        x={orientation === "vertical" ? x : x + i * step}
        y={orientation === "vertical" ? y + i * step : y}
      >
        {labels
          ? labels[i % labels.length]
          : formatMoney(from + i * increment, decimals)}
      </text>
    ))}
  </g>
);
