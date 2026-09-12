import React from "react";
import { useCurrentFrame } from "remotion";
import { buildIn, seededSeries, smoothNoise } from "../motion";
import { MONO_FONT, UI_FONT } from "../fonts";
import type { ChartProps } from "./types";

const LABELS = ["NET", "CPU", "MEM", "I/O", "LAT", "SYS", "RPS", "QPS", "ERR"];

// Rows of label / ticking number / mini bar, like a live telemetry list.
export const DataTable: React.FC<ChartProps> = ({
  width,
  height,
  theme,
  delay,
  seed,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const rows = 6;
  const rowH = height / rows;
  const base = seededSeries(seed, rows);
  const labels = seededSeries(seed + 1, rows).map(
    (v) => LABELS[Math.floor(v * LABELS.length)],
  );

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {base.map((b, i) => {
        const y = i * rowH + rowH / 2;
        const rowIn = buildIn(local, i * 5, 24);
        const n = smoothNoise(seed + i, frame * 0.04);
        const v = 0.25 + b * 0.45 + n * 0.3;
        const num = (v * 1000).toFixed(1).padStart(6, " ");
        const barX = width * 0.42;
        const barW = width * 0.58;
        return (
          <g key={i} opacity={rowIn} transform={`translate(${(1 - rowIn) * -16} 0)`}>
            <text
              x={0}
              y={y + 4}
              fill={theme.textDim}
              fontFamily={UI_FONT}
              fontSize={11}
              fontWeight={600}
              letterSpacing={1.5}
            >
              {labels[i]}
            </text>
            <text
              x={barX - 12}
              y={y + 4}
              textAnchor="end"
              fill={theme.text}
              fontFamily={MONO_FONT}
              fontSize={12}
              fontWeight={500}
            >
              {num}
            </text>
            <rect
              x={barX}
              y={y - 3}
              width={barW}
              height={6}
              rx={3}
              fill={theme.accent}
              opacity={0.22}
            />
            <rect
              x={barX}
              y={y - 3}
              width={barW * v}
              height={6}
              rx={3}
              fill={v > 0.8 ? theme.highlight : theme.accent}
              opacity={0.9}
            />
          </g>
        );
      })}
    </svg>
  );
};
