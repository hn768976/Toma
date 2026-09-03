import React, { useMemo } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { VALUES } from "../data";
import {
  dotsAlongPolyline,
  pointAtLength,
  polylineLengths,
  type Layout,
} from "../layout";
import type { Theme } from "../theme";
import { GLOW_PULSE, SERIES } from "../timing";

/**
 * The cyan series, drawn as individual round dots along the polyline. The dots
 * are rendered as real circles and revealed in sequence — a dashed stroke under
 * a moving mask would slide the dash phase around instead of adding one dot at
 * a time.
 *
 * `withArea` adds the V3 gradient fill, clipped to the same draw progress.
 */
export const SeriesLine: React.FC<{
  layout: Layout;
  theme: Theme;
  withArea?: boolean;
  /** Unique per composition so the SVG defs ids never collide. */
  idPrefix: string;
}> = ({ layout, theme, withArea = false, idPrefix }) => {
  const frame = useCurrentFrame();

  const { dots, head, areaPath } = useMemo(() => {
    const points = layout.seriesPoints;
    const { cumulative, total } = polylineLengths(points);
    return {
      dots: dotsAlongPolyline(points, layout.dotPitch),
      head: (p: number) => pointAtLength(points, cumulative, p * total),
      areaPath:
        `M ${points[0].x} ${layout.baselineY} ` +
        points.map((pt) => `L ${pt.x} ${pt.y}`).join(" ") +
        ` L ${points[points.length - 1].x} ${layout.baselineY} Z`,
    };
  }, [layout]);

  // Linear on purpose: the even pace is what makes it read as data.
  const progress = interpolate(frame, [SERIES.start, SERIES.end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const visible = Math.round(progress * dots.length);

  // A very slight breathing glow. Imperceptible while the line is drawing;
  // it is what keeps the long hold from looking like a freeze frame.
  const pulse =
    1 + GLOW_PULSE.amount * Math.sin((frame / GLOW_PULSE.period) * Math.PI * 2);

  const radius = layout.dotSize / 2;
  const clipId = `${idPrefix}-area-clip`;
  const gradientId = `${idPrefix}-area-fill`;
  const glowId = `${idPrefix}-glow`;

  const circles = (r: number) =>
    dots
      .slice(0, visible)
      .map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={r} fill={theme.series} />);

  return (
    <g>
      <defs>
        <filter
          id={glowId}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation={radius * 1.7} />
        </filter>
        {withArea ? (
          <>
            <linearGradient
              id={gradientId}
              x1="0"
              // Anchored at the series peak, so the fill reaches its full
              // 0.35 directly under the highest point of the line.
              y1={layout.valueToY(Math.max(...VALUES))}
              x2="0"
              y2={layout.baselineY}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={theme.series} stopOpacity={0.35} />
              <stop offset="100%" stopColor={theme.series} stopOpacity={0} />
            </linearGradient>
            <clipPath id={clipId}>
              <rect
                x={layout.axisX}
                y={layout.topY}
                width={Math.max(0, head(progress).x - layout.axisX)}
                height={layout.baselineY - layout.topY}
              />
            </clipPath>
          </>
        ) : null}
      </defs>

      {withArea ? (
        <path d={areaPath} fill={`url(#${gradientId})`} clipPath={`url(#${clipId})`} />
      ) : null}

      {theme.glow ? (
        <g filter={`url(#${glowId})`} opacity={0.38 * pulse}>
          {circles(radius * 1.25)}
        </g>
      ) : null}

      <g>{circles(radius)}</g>
    </g>
  );
};

/** Frame at which the series crosses the column of month `index`. */
export const lineCrossingFrame = (layout: Layout, index: number) => {
  const { cumulative, total } = polylineLengths(layout.seriesPoints);
  const fraction = cumulative[index + 1] / total;
  return SERIES.start + fraction * (SERIES.end - SERIES.start);
};
