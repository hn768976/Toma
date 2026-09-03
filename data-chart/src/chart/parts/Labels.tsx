import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { MONTHS, Y_TICKS } from "../data";
import type { Layout } from "../layout";
import { FONT_FAMILY, type Theme } from "../theme";
import { X_LABEL_FADE, Y_LABELS } from "../timing";

/** 100 … 1000, fading in bottom-to-top two frames apart. */
export const YLabels: React.FC<{
  layout: Layout;
  theme: Theme;
  ink: string;
}> = ({ layout, theme, ink }) => {
  const frame = useCurrentFrame();

  return (
    <g>
      {Y_TICKS.map((value, i) => {
        const start = Y_LABELS.start + i * Y_LABELS.stagger;
        const opacity = interpolate(
          frame,
          [start, start + Y_LABELS.fade],
          [0, theme.alpha.yLabel],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <text
            key={value}
            x={layout.yLabelRightX}
            y={layout.valueToY(value)}
            textAnchor="end"
            dominantBaseline="central"
            fill={ink}
            fillOpacity={opacity}
            fontFamily={FONT_FAMILY}
            fontSize={layout.yLabelSize}
            fontWeight={400}
          >
            {value}
          </text>
        );
      })}
    </g>
  );
};

/**
 * Month labels. Each one fades in as the series crosses its column, so the
 * X axis fills in behind the data rather than being there from the start.
 * `crossedAt` is supplied by the variant (line, bar or area) that owns the
 * left-to-right sweep.
 */
export const XLabels: React.FC<{
  layout: Layout;
  theme: Theme;
  ink: string;
  crossedAt: (monthIndex: number) => number;
}> = ({ layout, theme, ink, crossedAt }) => {
  const frame = useCurrentFrame();
  const letterSpacing = layout.xLabelSize * 0.22;

  return (
    <g>
      {MONTHS.map((month, i) => {
        // Centred on the crossing, so the label is up by the time the series
        // leaves the column and the last one lands inside the draw beat.
        const start = crossedAt(i) - X_LABEL_FADE / 2;
        const opacity = interpolate(
          frame,
          [start, start + X_LABEL_FADE],
          [0, theme.alpha.xLabel],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <text
            key={month}
            // SVG puts the letter-spacing after the last glyph too, so a
            // centred label sits half a space to the left without this nudge.
            x={layout.monthToX(i) + letterSpacing / 2}
            y={layout.xLabelBaselineY}
            textAnchor="middle"
            fill={ink}
            fillOpacity={opacity}
            fontFamily={FONT_FAMILY}
            fontSize={layout.xLabelSize}
            fontWeight={400}
            letterSpacing={letterSpacing}
          >
            {month}
          </text>
        );
      })}
    </g>
  );
};
