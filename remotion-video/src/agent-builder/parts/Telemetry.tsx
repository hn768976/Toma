import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import { Mono } from "../primitives";
import { FONT_MONO, type Theme } from "../theme";
import { LOG_LINES } from "../content";
import { T } from "../timeline";

const BAR_COUNT = 34;

/** Model-activity histogram. Deterministic per-bar noise, animated by frame. */
export const ActivityBars: React.FC<{
  theme: Theme;
  height?: number;
  bars?: number;
}> = ({ theme, height = 54, bars = BAR_COUNT }) => {
  const frame = useCurrentFrame();
  const active = frame >= T.typeStart;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        height,
      }}
    >
      {new Array(bars).fill(0).map((_, i) => {
        // Each bar walks its own slow sine, offset by a stable random phase.
        const phase = random(`bar-${i}`) * Math.PI * 2;
        const speed = 0.12 + random(`spd-${i}`) * 0.1;
        const wave = (Math.sin(frame * speed + phase) + 1) / 2;
        const base = 0.18 + random(`base-${i}`) * 0.5;
        const h = active ? Math.min(1, base + wave * 0.55) : base * 0.35;
        const hot = random(`hot-${i}`) > 0.72;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h * 100}%`,
              background: hot && active ? theme.barActive : theme.bar,
              opacity: hot && active ? 0.9 : 1,
              borderRadius: 1,
            }}
          />
        );
      })}
    </div>
  );
};

/** Three-line scrolling log. */
export const LogStream: React.FC<{ theme: Theme; rows?: number }> = ({
  theme,
  rows = 3,
}) => {
  const frame = useCurrentFrame();
  const step = Math.max(0, Math.floor((frame - T.typeStart) / 10));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {new Array(rows).fill(0).map((_, r) => {
        const idx = (step + r) % LOG_LINES.length;
        const [name, value] = LOG_LINES[idx];
        const seq = String((step + r) % 100).padStart(2, "0");
        return (
          <div
            key={r}
            style={{
              display: "flex",
              gap: 16,
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: 1.1,
              color: theme.textFaint,
              opacity: frame >= T.typeStart ? 1 : 0.25,
            }}
          >
            <span style={{ width: 26 }}>{seq}:</span>
            <span style={{ width: 128, color: theme.textDim }}>{name}</span>
            <span>{value}</span>
          </div>
        );
      })}
    </div>
  );
};

/** Throughput sparkline that draws in and keeps drifting. */
export const Sparkline: React.FC<{
  theme: Theme;
  width?: number;
  height?: number;
}> = ({ theme, width = 300, height = 60 }) => {
  const frame = useCurrentFrame();
  const points = 40;

  const path = new Array(points)
    .fill(0)
    .map((_, i) => {
      const x = (i / (points - 1)) * width;
      const noise =
        Math.sin(i * 0.55 + frame * 0.055) * 0.3 +
        Math.sin(i * 1.3 + frame * 0.03) * 0.16 +
        (random(`spark-${i}`) - 0.5) * 0.22;
      const y = height / 2 - noise * height * 0.72;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const draw = interpolate(frame, [T.typeStart, T.typeStart + 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <path
        d={path}
        fill="none"
        stroke={theme.accent}
        strokeWidth={1.6}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
        opacity={0.9}
      />
    </svg>
  );
};

/** "1.44 K/S"-style readout that ticks over time. */
export const ThroughputValue: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const v = 1.2 + (Math.sin(frame * 0.08) + 1) * 0.22;
  return (
    <Mono color={theme.textDim} size={10}>
      {v.toFixed(2)} K/S
    </Mono>
  );
};
