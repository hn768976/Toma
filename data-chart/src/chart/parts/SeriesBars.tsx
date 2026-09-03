import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { VALUES } from "../data";
import type { Layout } from "../layout";
import type { Theme } from "../theme";
import { GLOW_PULSE, SERIES } from "../timing";

/** Frames between one bar starting and the next, so the sweep fills the beat. */
export const barStagger =
  (SERIES.end - SERIES.start - SERIES.barGrow) /
  Math.max(1, VALUES.length - 1);

/** Frame at which bar `index` starts growing. */
export const barStartFrame = (index: number) =>
  SERIES.start + index * barStagger;

/**
 * V2: one bar per month, growing out of the baseline with easeOutCubic and
 * staggered so the sweep left-to-right takes the same beat as the line draw.
 */
export const SeriesBars: React.FC<{
  layout: Layout;
  theme: Theme;
  idPrefix: string;
}> = ({ layout, theme, idPrefix }) => {
  const frame = useCurrentFrame();
  const pulse =
    1 + GLOW_PULSE.amount * Math.sin((frame / GLOW_PULSE.period) * Math.PI * 2);

  const gradientId = `${idPrefix}-bar-fill`;
  const glowId = `${idPrefix}-bar-glow`;

  const bars = VALUES.map((value, i) => {
    const start = barStartFrame(i);
    const grown = interpolate(frame, [start, start + SERIES.barGrow], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const fullHeight = layout.baselineY - layout.valueToY(value);
    const height = fullHeight * grown;
    return { key: i, height, x: layout.monthToX(i) - layout.barWidth / 2 };
  });

  const rects = bars
    .filter((b) => b.height > 0)
    .map((b) => (
      <rect
        key={b.key}
        x={b.x}
        y={layout.baselineY - b.height}
        width={layout.barWidth}
        height={b.height}
        fill={`url(#${gradientId})`}
      />
    ));

  return (
    <g>
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1={layout.topY}
          x2="0"
          y2={layout.baselineY}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={theme.series} stopOpacity={1} />
          <stop offset="100%" stopColor={theme.series} stopOpacity={0.55} />
        </linearGradient>
        <filter
          id={glowId}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation={layout.dotSize} />
        </filter>
      </defs>

      {theme.glow ? (
        <g filter={`url(#${glowId})`} opacity={0.5 * pulse}>
          {rects}
        </g>
      ) : null}
      <g>{rects}</g>
    </g>
  );
};
