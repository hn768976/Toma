import React from "react";
import { AbsoluteFill } from "remotion";
import { rgba } from "../color";
import {
  AXIS_Y,
  DESIGN_HEIGHT,
  GRID_MAJOR,
  LABEL_COUNT,
  LABEL_SPACING,
  LABEL_START,
  LABEL_STEP,
} from "../constants";
import { LABEL_FONT_FAMILY } from "../load-fonts";
import type { Theme } from "../theme";

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Voltage axis: static, since the display only scrolls in time. Zero sits on
 * the main sine's centre line and the steps follow the major divisions, so the
 * numbers agree with the grid instead of merely decorating the left edge.
 */
const LEFT_STEPS = [-3, -2, -1, 0, 1, 2, 3];

/**
 * Numeric axis labels. The horizontal ones ride the grid; their values cycle
 * through LABEL_COUNT steps whose total pitch is exactly one loop of travel, so
 * the sequence wraps at the same moment the scroll does.
 */
export const AxisLabels: React.FC<{
  theme: Theme;
  scroll: number;
  scale: number;
  width: number;
}> = ({ theme, scroll, scale, width }) => {
  const designWidth = width / scale;
  const fontSize = 30 * scale;
  const color = rgba(theme.labelColor, theme.labelOpacity);

  const first =
    Math.floor((scroll - LABEL_SPACING) / LABEL_SPACING) * LABEL_SPACING;

  const bottom: React.ReactNode[] = [];
  for (
    let worldX = first;
    worldX <= scroll + designWidth + LABEL_SPACING;
    worldX += LABEL_SPACING
  ) {
    const index = mod(Math.round(worldX / LABEL_SPACING), LABEL_COUNT);
    const value = LABEL_START + index * LABEL_STEP;
    bottom.push(
      <div
        key={worldX}
        style={{
          position: "absolute",
          left: (worldX - scroll) * scale,
          top: DESIGN_HEIGHT * 0.955 * scale,
          transform: "translateX(-50%)",
          fontSize,
          letterSpacing: 0.06 * fontSize,
          color,
          whiteSpace: "nowrap",
        }}
      >
        {value.toFixed(2)}
      </div>,
    );
  }

  return (
    <AbsoluteFill
      style={{
        fontFamily: `${LABEL_FONT_FAMILY}, ui-monospace, monospace`,
        fontWeight: 400,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {bottom}
      {LEFT_STEPS.map((step) => (
        <div
          key={step}
          style={{
            position: "absolute",
            left: GRID_MAJOR * 0.22 * scale,
            top: (AXIS_Y + step * GRID_MAJOR) * scale - fontSize * 1.05,
            fontSize: fontSize * 0.88,
            letterSpacing: 0.06 * fontSize,
            color: rgba(theme.labelColor, theme.labelOpacity * 0.6),
          }}
        >
          {(-step * 0.5).toFixed(1)}
        </div>
      ))}
    </AbsoluteFill>
  );
};
