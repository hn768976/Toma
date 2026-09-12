import React from "react";
import { useCurrentFrame } from "remotion";
import { BUILD_IN_FRAMES } from "../constants";
import { buildIn, smoothNoise } from "../motion";
import type { ChartProps } from "./types";

const seriesPath = (
  seed: number,
  frame: number,
  width: number,
  height: number,
  count: number,
  scrollSpeed: number,
  amplitude: number,
) => {
  const pts: string[] = [];
  const step = width / (count - 1);
  const offset = frame * scrollSpeed;
  for (let i = 0; i < count; i++) {
    const n = smoothNoise(seed, i * 0.9 + offset);
    const y = height * (0.85 - n * amplitude);
    pts.push(`${i * step} ${y}`);
  }
  return pts;
};

// Two scrolling multi-point lines with a filled area under the primary one
// and y-axis guide lines.
export const LineChart: React.FC<ChartProps> = ({
  width,
  height,
  theme,
  delay,
  seed,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const count = 14;
  const a = seriesPath(seed, frame, width, height, count, 0.012, 0.7);
  const b = seriesPath(seed + 11, frame, width, height, count, 0.009, 0.5);
  const lineA = `M ${a.join(" L ")}`;
  const lineB = `M ${b.join(" L ")}`;
  const areaA = `${lineA} L ${width} ${height} L 0 ${height} Z`;
  const drawn = buildIn(local, 0, BUILD_IN_FRAMES);
  const areaIn = buildIn(local, 20, BUILD_IN_FRAMES);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`area-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.accent} stopOpacity={0.55} />
          <stop offset="1" stopColor={theme.accent} stopOpacity={0.02} />
        </linearGradient>
        <clipPath id={`clip-${seed}`}>
          <rect x={0} y={0} width={width * drawn} height={height} />
        </clipPath>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={0}
          y1={height * t}
          x2={width}
          y2={height * t}
          stroke={theme.accent}
          strokeOpacity={0.18}
          strokeWidth={1}
          strokeDasharray="4 6"
        />
      ))}
      <g clipPath={`url(#clip-${seed})`}>
        <path d={areaA} fill={`url(#area-${seed})`} opacity={areaIn} />
        <path
          d={lineB}
          fill="none"
          stroke={theme.accentAlt}
          strokeOpacity={0.8}
          strokeWidth={2}
        />
        <path
          d={lineA}
          fill="none"
          stroke={theme.highlight}
          strokeWidth={2.5}
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 5px ${theme.highlightSoft})` }}
        />
        {a.map((p, i) => {
          const [x, y] = p.split(" ").map(Number);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i % 3 === 0 ? 3 : 1.8}
              fill={theme.highlight}
            />
          );
        })}
      </g>
    </svg>
  );
};
