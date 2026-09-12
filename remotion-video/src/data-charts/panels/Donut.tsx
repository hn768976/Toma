import React from "react";
import { useCurrentFrame } from "remotion";
import { BUILD_IN_FRAMES } from "../constants";
import { buildIn, seededSeries } from "../motion";
import { MONO_FONT, UI_FONT } from "../fonts";
import type { ChartProps } from "./types";

const TAU = Math.PI * 2;

// Segmented donut that sweeps in, with a small legend of read-outs beside it.
export const Donut: React.FC<ChartProps> = ({
  width,
  height,
  theme,
  delay,
  seed,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const r = Math.min(width * 0.45, height) / 2 - 4;
  const cx = r + 6;
  const cy = height / 2;
  const raw = seededSeries(seed, 4).map((v) => 0.4 + v);
  const total = raw.reduce((a, b) => a + b, 0);
  const shares = raw.map((v) => v / total);
  const sweep = buildIn(local, 0, BUILD_IN_FRAMES);
  const colors = [theme.highlight, theme.accent, theme.accentAlt, theme.accentSoft];
  const circ = TAU * r;

  let acc = 0;
  const arcs = shares.map((s, i) => {
    const start = acc;
    acc += s;
    const visible = Math.max(0, Math.min(s, sweep - start));
    return { start, len: visible, color: colors[i], share: s };
  });

  const legendX = cx + r + 26;
  const legendRowH = Math.min(30, height / 4.5);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.accent} strokeOpacity={0.18} strokeWidth={14} />
      {arcs.map((a, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={a.color}
          strokeWidth={14}
          strokeDasharray={`${circ * a.len} ${circ}`}
          strokeDashoffset={-circ * a.start}
          transform={`rotate(${-90 + frame * 0.15} ${cx} ${cy})`}
        />
      ))}
      <text
        x={cx}
        y={cy + 7}
        textAnchor="middle"
        fill={theme.text}
        fontFamily={MONO_FONT}
        fontSize={20}
        fontWeight={500}
        opacity={buildIn(local, 20, 30)}
      >
        {(sweep * 8.4).toFixed(1)}
        <tspan fontSize={12} fill={theme.textDim}>
          k
        </tspan>
      </text>
      {arcs.map((a, i) => {
        const y = cy - (legendRowH * 1.5) + i * legendRowH;
        const rowIn = buildIn(local, 10 + i * 6, 24);
        return (
          <g key={i} opacity={rowIn}>
            <rect x={legendX} y={y - 5} width={10} height={10} rx={2} fill={a.color} />
            <text x={legendX + 18} y={y + 4} fill={theme.textDim} fontFamily={UI_FONT} fontSize={11} fontWeight={600} letterSpacing={1.2}>
              {["ALPHA", "BETA", "GAMMA", "DELTA"][i]}
            </text>
            <text x={width} y={y + 4} textAnchor="end" fill={theme.text} fontFamily={MONO_FONT} fontSize={12}>
              {(a.share * 100).toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
};
