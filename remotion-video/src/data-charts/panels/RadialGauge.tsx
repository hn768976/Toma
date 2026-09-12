import React from "react";
import { useCurrentFrame } from "remotion";
import { BUILD_IN_FRAMES } from "../constants";
import { buildIn, buildInBack, seededSeries } from "../motion";
import { MONO_FONT } from "../fonts";
import type { ChartProps } from "./types";

type Props = ChartProps & {
  // 0..1 fill of the main progress arc.
  value: number;
  // Shows the numeric read-out in the middle.
  showValue?: boolean;
};

const TAU = Math.PI * 2;

// Concentric HUD-style rings: a slowly counter-rotating tick ring, a
// segmented ring, a bright progress arc that sweeps in, and crosshair
// ticks. All stroke-based so it stays crisp at 4K.
export const RadialGauge: React.FC<Props> = ({
  width,
  height,
  theme,
  delay,
  seed,
  value,
  showValue = true,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2 - 6;

  const segments = seededSeries(seed, 24);

  const ringIn = buildIn(local, 0, BUILD_IN_FRAMES * 0.6);
  const arcIn = buildInBack(local, 10, BUILD_IN_FRAMES);
  const progress = value * arcIn;

  const outerR = r;
  const tickR = r * 0.9;
  const segR = r * 0.74;
  const arcR = r * 0.56;
  const innerR = r * 0.42;

  const arcCirc = TAU * arcR;
  const innerCirc = TAU * innerR;

  const rotSlow = frame * 0.25;
  const rotBack = -frame * 0.4;

  const readout = Math.round(progress * 100);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Outer faint ring, drawn on */}
      <circle
        cx={cx}
        cy={cy}
        r={outerR}
        fill="none"
        stroke={theme.accent}
        strokeOpacity={0.35}
        strokeWidth={1.2}
        pathLength={1}
        strokeDasharray={`${ringIn} 1`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />

      {/* Rotating tick ring */}
      <g
        transform={`rotate(${rotSlow} ${cx} ${cy})`}
        opacity={ringIn}
        stroke={theme.accentAlt}
        strokeWidth={1.5}
      >
        {Array.from({ length: 72 }, (_, i) => {
          const a = (i / 72) * TAU;
          const major = i % 6 === 0;
          const len = major ? 10 : 4;
          const x1 = cx + Math.cos(a) * tickR;
          const y1 = cy + Math.sin(a) * tickR;
          const x2 = cx + Math.cos(a) * (tickR - len);
          const y2 = cy + Math.sin(a) * (tickR - len);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeOpacity={major ? 0.9 : 0.45}
            />
          );
        })}
      </g>

      {/* Segmented ring, counter-rotating, with a few "lit" segments */}
      <g transform={`rotate(${rotBack} ${cx} ${cy})`} opacity={ringIn}>
        {segments.map((v, i) => {
          const a0 = (i / segments.length) * TAU;
          const a1 = ((i + 0.72) / segments.length) * TAU;
          const lit = v > 0.55;
          const d = `M ${cx + Math.cos(a0) * segR} ${cy + Math.sin(a0) * segR} A ${segR} ${segR} 0 0 1 ${cx + Math.cos(a1) * segR} ${cy + Math.sin(a1) * segR}`;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={lit ? theme.accent : theme.accentAlt}
              strokeOpacity={lit ? 0.95 : 0.3}
              strokeWidth={lit ? 5 : 2}
            />
          );
        })}
      </g>

      {/* Track + bright progress arc */}
      <circle
        cx={cx}
        cy={cy}
        r={arcR}
        fill="none"
        stroke={theme.accent}
        strokeOpacity={0.25}
        strokeWidth={7}
      />
      <circle
        cx={cx}
        cy={cy}
        r={arcR}
        fill="none"
        stroke={theme.highlight}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${arcCirc * progress} ${arcCirc}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{
          filter: `drop-shadow(0 0 6px ${theme.highlightSoft})`,
        }}
      />

      {/* Inner thin ring that draws on then pulses */}
      <circle
        cx={cx}
        cy={cy}
        r={innerR}
        fill="none"
        stroke={theme.highlight}
        strokeOpacity={0.7 + 0.3 * Math.sin(frame * 0.12)}
        strokeWidth={1.5}
        strokeDasharray={`${innerCirc * buildIn(local, 20, 50)} ${innerCirc}`}
        transform={`rotate(${90 + frame * 0.6} ${cx} ${cy})`}
      />

      {/* Crosshair ticks */}
      <g stroke={theme.highlight} strokeOpacity={0.8} strokeWidth={1.5} opacity={ringIn}>
        {[0, 90, 180, 270].map((deg) => {
          const a = (deg / 180) * Math.PI;
          const x1 = cx + Math.cos(a) * (innerR + 6);
          const y1 = cy + Math.sin(a) * (innerR + 6);
          const x2 = cx + Math.cos(a) * (arcR - 8);
          const y2 = cy + Math.sin(a) * (arcR - 8);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>

      {showValue ? (
        <text
          x={cx}
          y={cy + 9}
          textAnchor="middle"
          fill={theme.text}
          fontFamily={MONO_FONT}
          fontSize={26}
          fontWeight={500}
          opacity={buildIn(local, 20, 30)}
        >
          {readout}
          <tspan fontSize={13} fill={theme.textDim}>
            %
          </tspan>
        </text>
      ) : null}
    </svg>
  );
};
