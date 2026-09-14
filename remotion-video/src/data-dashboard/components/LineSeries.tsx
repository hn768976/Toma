import React from "react";
import { useCurrentFrame } from "remotion";
import { revealAt } from "../animation";
import { pointAt, seriesPath, type PlotBand, type Series } from "../series";

export type LineSeriesProps = {
  series: Series;
  band: PlotBand;
  color: string;
  strokeWidth?: number;
  // Frame the line starts drawing, and how long the draw-on takes.
  drawStart?: number;
  drawDuration?: number;
  // Bloom is faked with two extra wide, translucent copies of the same
  // path rather than a blur filter: it stays perfectly crisp at 4K and
  // costs a fraction of a filter pass per series.
  glow?: number;
  opacity?: number;
  // Bright dot riding the head of the line while it draws.
  head?: boolean;
};

export const LineSeries: React.FC<LineSeriesProps> = ({
  series,
  band,
  color,
  strokeWidth = 3,
  drawStart = 0,
  drawDuration = 90,
  glow = 1,
  opacity = 1,
  head = false,
}) => {
  const frame = useCurrentFrame();
  const progress = revealAt(frame, drawStart, drawDuration);
  if (progress <= 0) {
    return null;
  }

  const d = seriesPath(series, band);
  // pathLength=1 normalises the dash pattern, so the draw-on works
  // without measuring the path in the DOM (which Remotion would have to
  // wait for, and which differs between resolutions).
  const dash = {
    pathLength: 1,
    strokeDasharray: "1 1",
    strokeDashoffset: 1 - progress,
  } as const;

  const headIndex = Math.min(
    series.length - 1,
    Math.max(0, Math.round(progress * (series.length - 1))),
  );
  const headPoint = pointAt(series, band, headIndex);

  return (
    <g
      opacity={opacity}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glow > 0 ? (
        <>
          <path
            d={d}
            stroke={color}
            strokeWidth={strokeWidth * 6}
            opacity={0.07 * glow}
            {...dash}
          />
          <path
            d={d}
            stroke={color}
            strokeWidth={strokeWidth * 2.6}
            opacity={0.16 * glow}
            {...dash}
          />
        </>
      ) : null}
      <path d={d} stroke={color} strokeWidth={strokeWidth} {...dash} />
      {head && progress < 1 ? (
        <>
          <circle
            cx={headPoint.x}
            cy={headPoint.y}
            r={strokeWidth * 3.2}
            fill={color}
            opacity={0.22}
          />
          <circle
            cx={headPoint.x}
            cy={headPoint.y}
            r={strokeWidth * 1.15}
            fill="#ffffff"
          />
        </>
      ) : null}
    </g>
  );
};
