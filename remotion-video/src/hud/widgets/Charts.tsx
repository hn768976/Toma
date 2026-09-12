import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { rampTo, wobble } from "../anim";
import { rngFor } from "../random";
import { FONT_MONO, FONT_UI, type HudTheme } from "../theme";
import { MONTHS } from "../text";

// Twelve-bar histogram with a month axis, each bar growing on its own
// slight delay so the group builds left to right rather than as a block.
export const BarChart: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  width?: number;
  height?: number;
  bars?: number;
  seed: string;
}> = ({ theme, x, y, width = 300, height = 120, bars = 12, seed }) => {
  const frame = useCurrentFrame();

  const model = useMemo(() => {
    const rand = rngFor(`${seed}:bars`);
    return Array.from({ length: bars }, () => ({
      target: 0.24 + rand() * 0.76,
      delay: rand() * 0.1,
      cycles: 1 + Math.floor(rand() * 3),
    }));
  }, [seed, bars]);

  const slot = width / bars;
  const barW = slot * 0.56;

  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1={0} y1={height} x2={width} y2={height} stroke={theme.lineSoft} strokeWidth={1.6} />
      <line x1={0} y1={0} x2={0} y2={height} stroke={theme.lineSoft} strokeWidth={1.6} />
      {model.map((b, i) => {
        const grown = rampTo(frame, b.target, b.delay, 0.45, b.target * 0.72);
        const h = Math.min(
          height,
          Math.max(2, wobble(frame, grown, 0.045, b.cycles, i * 0.13) * height),
        );
        const bx = i * slot + (slot - barW) / 2;
        return (
          <g key={i}>
            <rect
              x={bx}
              y={0}
              width={barW}
              height={height}
              fill={theme.barTrack}
              opacity={0.35}
            />
            <rect x={bx} y={height - h} width={barW} height={h} fill={theme.barFill} />
            <text
              x={bx + barW / 2}
              y={height + 14}
              textAnchor="middle"
              fontFamily={FONT_UI}
              fontSize={9}
              fill={theme.textDim}
              letterSpacing={0.4}
            >
              {MONTHS[i % MONTHS.length]}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// Multi-series line chart laid over banded rows, as in the reference's
// top-left monitor panel.
export const LineMonitor: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  width?: number;
  height?: number;
  series?: number;
  points?: number;
  seed: string;
}> = ({ theme, x, y, width = 240, height = 100, series = 3, points = 16, seed }) => {
  const frame = useCurrentFrame();

  const model = useMemo(() => {
    const rand = rngFor(`${seed}:lines`);
    return Array.from({ length: series }, () =>
      Array.from({ length: points }, () => ({
        base: 0.25 + rand() * 0.5,
        cycles: 1 + Math.floor(rand() * 2),
        phase: rand(),
      })),
    );
  }, [seed, series, points]);

  const bands = 6;

  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: bands }, (_, i) => (
        <rect
          key={i}
          x={0}
          y={(i * height) / bands}
          width={width}
          height={height / bands - 2}
          fill={theme.barTrack}
          opacity={i % 2 === 0 ? 0.3 : 0.14}
        />
      ))}
      {model.map((serie, si) => {
        const d = serie
          .map((p, i) => {
            const px = (i / (points - 1)) * width;
            const v = wobble(frame, p.base, 0.18, p.cycles, p.phase);
            const py = height - Math.max(0.04, Math.min(0.96, v)) * height;
            return `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`;
          })
          .join("");
        return (
          <path
            key={si}
            d={d}
            fill="none"
            stroke={si === 0 ? theme.accent : theme.lineSoft}
            strokeWidth={si === 0 ? 1.8 : 1.4}
            opacity={si === 0 ? 0.95 : 0.7}
          />
        );
      })}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="none"
        stroke={theme.lineFaint}
        strokeWidth={1.2}
      />
    </g>
  );
};

// Labelled horizontal bars that extend as their readings climb.
export const BarRows: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  width?: number;
  rows?: number;
  rowHeight?: number;
  seed: string;
}> = ({ theme, x, y, width = 190, rows = 4, rowHeight = 17, seed }) => {
  const frame = useCurrentFrame();

  const model = useMemo(() => {
    const rand = rngFor(`${seed}:barrows`);
    return Array.from({ length: rows }, (_, i) => ({
      label: `${2019 + Math.floor(rand() * 8)}`,
      target: 0.35 + rand() * 0.65,
      delay: i * 0.03 + rand() * 0.06,
    }));
  }, [seed, rows]);

  return (
    <g transform={`translate(${x} ${y})`}>
      {model.map((r, i) => {
        const w = rampTo(frame, r.target, r.delay, 0.5, r.target * 0.6) * (width - 44);
        return (
          <g key={i} transform={`translate(0 ${i * rowHeight})`}>
            <text
              y={8}
              fontFamily={FONT_MONO}
              fontSize={9}
              fill={theme.textDim}
            >
              {r.label}
            </text>
            <rect x={40} y={0} width={w} height={9} fill={theme.barFill} opacity={0.92} />
          </g>
        );
      })}
    </g>
  );
};
