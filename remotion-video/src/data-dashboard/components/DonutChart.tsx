import React from "react";
import { useCurrentFrame } from "remotion";
import { revealAt } from "../animation";
import { FONT_MONO } from "../constants";
import { mulberry32 } from "../random";

export type DonutChartProps = {
  cx: number;
  cy: number;
  radius: number;
  innerRadius?: number;
  segments?: number;
  seed: number;
  color?: string;
  accentColor?: string;
  labelColor?: string;
  // Ticks and years ringing the outside of the donut.
  years?: string[];
  appearAt?: number;
  // Degrees per second of slow rotation.
  spin?: number;
  opacity?: number;
};

export const DonutChart: React.FC<DonutChartProps> = ({
  cx,
  cy,
  radius,
  innerRadius,
  segments = 7,
  seed,
  color = "#63b8f0",
  accentColor = "#ff6f5e",
  labelColor = "rgba(160, 210, 255, 0.8)",
  years,
  appearAt = 0,
  spin = 6,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const reveal = revealAt(frame, appearAt, 34);
  if (reveal <= 0) {
    return null;
  }

  const inner = innerRadius ?? radius * 0.42;
  const rand = mulberry32(seed * 1721 + 3);
  const weights = Array.from({ length: segments }, () => 0.5 + rand());
  const total = weights.reduce((a, b) => a + b, 0);
  const rotation = (frame / 30) * spin;

  // Each wedge is a filled annulus slice with a small gap to its
  // neighbour, matching the segmented pie in the references.
  let angle = -90;
  const wedges = weights.map((w, i) => {
    const sweep = (w / total) * 360 - 1.2;
    const start = angle;
    const end = angle + sweep * reveal;
    angle += (w / total) * 360;
    const toXY = (r: number, deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return `${(cx + Math.cos(rad) * r).toFixed(2)},${(cy + Math.sin(rad) * r).toFixed(2)}`;
    };
    const large = end - start > 180 ? 1 : 0;
    const d = [
      `M${toXY(radius, start)}`,
      `A${radius},${radius} 0 ${large} 1 ${toXY(radius, end)}`,
      `L${toXY(inner, end)}`,
      `A${inner},${inner} 0 ${large} 0 ${toXY(inner, start)}`,
      "Z",
    ].join(" ");
    return <path key={i} d={d} fill={color} opacity={0.62 + (i % 3) * 0.13} />;
  });

  return (
    <g opacity={opacity * reveal}>
      <g transform={`rotate(${rotation} ${cx} ${cy})`}>
        {wedges}
        <circle
          cx={cx}
          cy={cy}
          r={inner * 0.86}
          fill="none"
          stroke={accentColor}
          strokeWidth={radius * 0.035}
          opacity={0.85}
        />
      </g>
      {years ? (
        <g
          fontFamily={FONT_MONO}
          fontSize={radius * 0.17}
          fill={labelColor}
          textAnchor="middle"
        >
          {years.map((year, i) => {
            const deg = -90 + (i / years.length) * 360;
            const rad = (deg * Math.PI) / 180;
            const tickInner = radius * 1.1;
            const tickOuter = radius * 1.24;
            const labelR = radius * 1.45;
            return (
              <g key={year}>
                <line
                  x1={cx + Math.cos(rad) * tickInner}
                  y1={cy + Math.sin(rad) * tickInner}
                  x2={cx + Math.cos(rad) * tickOuter}
                  y2={cy + Math.sin(rad) * tickOuter}
                  stroke={accentColor}
                  strokeWidth={radius * 0.025}
                  opacity={0.75}
                />
                <text
                  x={cx + Math.cos(rad) * labelR}
                  y={cy + Math.sin(rad) * labelR + radius * 0.06}
                >
                  {year}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}
    </g>
  );
};
