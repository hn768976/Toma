import React from "react";
import { useCurrentFrame } from "remotion";
import { BUILD_IN_FRAMES } from "../constants";
import { buildIn, seededSeries, smoothNoise } from "../motion";
import type { ChartProps } from "./types";

// Dense thin bars that ripple like a live signal / audio spectrum.
export const Spectrum: React.FC<ChartProps> = ({
  width,
  height,
  theme,
  delay,
  seed,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const count = 48;
  const gap = 3;
  const barW = (width - gap * (count - 1)) / count;
  const bias = seededSeries(seed, count);
  const reveal = buildIn(local, 0, BUILD_IN_FRAMES);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bias.map((b, i) => {
        const n = smoothNoise(seed + i, frame * 0.06 + i * 0.2);
        const env = 0.35 + 0.65 * Math.sin((i / count) * Math.PI);
        const h = height * (0.15 + 0.85 * n * env) * (0.4 + b * 0.6) * reveal;
        const bright = n > 0.72;
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            fill={bright ? theme.highlight : theme.accent}
            opacity={bright ? 0.95 : 0.7}
          />
        );
      })}
      <line
        x1={0}
        y1={height - 0.5}
        x2={width}
        y2={height - 0.5}
        stroke={theme.accent}
        strokeOpacity={0.5}
      />
    </svg>
  );
};
