import React from "react";
import { useCurrentFrame } from "remotion";
import { BUILD_IN_FRAMES } from "../constants";
import { buildIn, buildInBack, seededSeries } from "../motion";
import type { ChartProps } from "./types";

// Bright vertical bars that grow in with a stagger, plus a trend line that
// draws on over them (as in the reference's right-hand panel).
export const BarChart: React.FC<ChartProps> = ({
  width,
  height,
  theme,
  delay,
  seed,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const count = 9;
  const values = seededSeries(seed, count).map((v) => 0.3 + v * 0.7);
  const gap = 12;
  const barW = (width - gap * (count - 1)) / count;
  const baseY = height - 6;
  const maxH = height - 16;

  const points = values.map((v, i) => {
    const wobble = Math.sin(frame * 0.05 + i * 1.3) * 0.02;
    const grow = buildInBack(local, i * 4, BUILD_IN_FRAMES * 0.7);
    const h = maxH * (v + wobble) * grow;
    return { x: i * (barW + gap), y: baseY - h, h };
  });

  const linePath = points
    .map((p, i) => {
      const x = p.x + barW / 2;
      const y = baseY - (maxH * (0.45 + values[(i + 3) % count] * 0.45));
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const lineIn = buildIn(local, 20, BUILD_IN_FRAMES);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`bar-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.highlight} stopOpacity={1} />
          <stop offset="1" stopColor={theme.accent} stopOpacity={0.85} />
        </linearGradient>
      </defs>
      {/* baseline */}
      <line
        x1={0}
        y1={baseY + 2}
        x2={width}
        y2={baseY + 2}
        stroke={theme.accent}
        strokeOpacity={0.5}
        strokeWidth={1}
      />
      {points.map((p, i) => (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={barW}
          height={Math.max(0, p.h)}
          rx={2}
          fill={`url(#bar-${seed})`}
          style={{ filter: `drop-shadow(0 0 8px ${theme.highlightSoft})` }}
        />
      ))}
      <path
        d={linePath}
        fill="none"
        stroke={theme.accentAlt}
        strokeWidth={2.5}
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={`${lineIn} 1`}
        opacity={0.95}
      />
      {points.map((p, i) => {
        const x = p.x + barW / 2;
        const y = baseY - (maxH * (0.45 + values[(i + 3) % count] * 0.45));
        const show = lineIn > (i + 0.5) / count ? 1 : 0;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={3.5}
            fill={theme.highlight}
            opacity={show}
          />
        );
      })}
    </svg>
  );
};
