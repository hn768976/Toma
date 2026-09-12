import React from "react";
import { useCurrentFrame } from "remotion";
import { buildIn, seededSeries, smoothNoise } from "../motion";
import type { ChartProps } from "./types";

// Grid of small cells whose brightness flickers, like a status matrix.
export const HeatGrid: React.FC<ChartProps> = ({
  width,
  height,
  theme,
  delay,
  seed,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const cols = 16;
  const rows = Math.max(3, Math.floor(height / (width / cols)));
  const cell = width / cols;
  const bias = seededSeries(seed, cols * rows);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bias.map((b, i) => {
        const c = i % cols;
        const rIdx = Math.floor(i / cols);
        const n = smoothNoise(seed + i, frame * 0.05);
        const level = b * 0.5 + n * 0.5;
        const on = buildIn(local, (c + rIdx) * 2, 18);
        const hot = level > 0.78;
        return (
          <rect
            key={i}
            x={c * cell + 2}
            y={rIdx * cell + 2}
            width={cell - 4}
            height={cell - 4}
            rx={2}
            fill={hot ? theme.highlight : theme.accent}
            opacity={on * (hot ? 0.95 : 0.12 + level * 0.5)}
          />
        );
      })}
    </svg>
  );
};
