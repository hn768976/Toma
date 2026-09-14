import React from "react";
import { useCurrentFrame } from "remotion";
import { revealAt } from "../animation";
import { FONT_MONO } from "../constants";
import { mulberry32 } from "../random";

type Bracket = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
};

// The corner brackets that frame the small HUD widgets. Drawn as four
// short L shapes so the frame reads as a technical readout rather than
// a plain box.
const CornerBrackets: React.FC<Bracket> = ({
  x,
  y,
  width,
  height,
  color,
  strokeWidth,
}) => {
  const arm = Math.min(width, height) * 0.22;
  const corners = [
    `M${x},${y + arm} L${x},${y} L${x + arm},${y}`,
    `M${x + width - arm},${y} L${x + width},${y} L${x + width},${y + arm}`,
    `M${x + width},${y + height - arm} L${x + width},${y + height} L${x + width - arm},${y + height}`,
    `M${x + arm},${y + height} L${x},${y + height} L${x},${y + height - arm}`,
  ];
  return (
    <g fill="none" stroke={color} strokeWidth={strokeWidth} opacity={0.85}>
      {corners.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
};

export type SpectrumWidgetProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  seed: number;
  colors: [string, string];
  frameColor?: string;
  labels?: string[];
  appearAt?: number;
  opacity?: number;
};

// The small twin-tone bar readout that sits along the top of the wider
// layouts. Bars jitter every few frames, like a live feed.
export const SpectrumWidget: React.FC<SpectrumWidgetProps> = ({
  x,
  y,
  width,
  height,
  seed,
  colors,
  frameColor = "rgba(140, 195, 255, 0.6)",
  labels = ["Q1", "Q2", "Q3", "Q4"],
  appearAt = 0,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const reveal = revealAt(frame, appearAt, 26);
  if (reveal <= 0) {
    return null;
  }

  const count = 34;
  const slot = width / count;
  const rand = mulberry32(seed * 911 + 17);
  const seeds = Array.from({ length: count }, () => rand() * Math.PI * 2);

  return (
    <g opacity={opacity * reveal}>
      <CornerBrackets
        x={x}
        y={y}
        width={width}
        height={height}
        color={frameColor}
        strokeWidth={height * 0.03}
      />
      {seeds.map((phase, i) => {
        const wave =
          0.25 +
          (Math.sin(frame * 0.16 + phase) * 0.5 + 0.5) *
            0.7 *
            (0.5 + 0.5 * Math.sin(phase));
        const h = wave * height * 0.72 * reveal;
        return (
          <rect
            key={i}
            x={x + i * slot + slot * 0.18}
            y={y + height * 0.82 - h}
            width={slot * 0.64}
            height={h}
            fill={i % 2 === 0 ? colors[0] : colors[1]}
            opacity={0.8}
          />
        );
      })}
      <line
        x1={x}
        y1={y + height * 0.82}
        x2={x + width}
        y2={y + height * 0.82}
        stroke={frameColor}
        strokeWidth={height * 0.02}
        opacity={0.5}
      />
      <g
        fontFamily={FONT_MONO}
        fontSize={height * 0.14}
        fill={frameColor}
        textAnchor="middle"
      >
        {labels.map((label, i) => (
          <text
            key={label}
            x={x + ((i + 0.5) / labels.length) * width}
            y={y + height * 0.99}
          >
            {label}
          </text>
        ))}
      </g>
    </g>
  );
};

export type CandleWidgetProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  seed: number;
  upColor?: string;
  downColor?: string;
  frameColor?: string;
  appearAt?: number;
  opacity?: number;
};

// Candlestick mini-chart with a red measurement bracket, as seen in the
// top-right of the wide reference frames.
export const CandleWidget: React.FC<CandleWidgetProps> = ({
  x,
  y,
  width,
  height,
  seed,
  upColor = "#ece55e",
  downColor = "#ff6f5e",
  frameColor = "#ff6f5e",
  appearAt = 0,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const reveal = revealAt(frame, appearAt, 30);
  if (reveal <= 0) {
    return null;
  }

  const count = 40;
  const slot = width / count;
  const rand = mulberry32(seed * 3301 + 11);
  let level = 0.5;
  const candles = Array.from({ length: count }, () => {
    const open = level;
    level += (rand() - 0.5) * 0.16;
    level = Math.min(0.92, Math.max(0.08, level));
    const close = level;
    const wick = 0.03 + rand() * 0.06;
    return { open, close, wick };
  });

  const visible = Math.round(count * reveal);

  return (
    <g opacity={opacity}>
      <line
        x1={x}
        y1={y}
        x2={x}
        y2={y + height}
        stroke={frameColor}
        strokeWidth={height * 0.012}
        opacity={0.9}
      />
      <line
        x1={x}
        y1={y}
        x2={x + width * 0.1}
        y2={y}
        stroke={frameColor}
        strokeWidth={height * 0.012}
        opacity={0.9}
      />
      <line
        x1={x}
        y1={y + height}
        x2={x + width * 0.1}
        y2={y + height}
        stroke={frameColor}
        strokeWidth={height * 0.012}
        opacity={0.9}
      />
      {candles.slice(0, visible).map((candle, i) => {
        const cx = x + width * 0.14 + i * slot * 0.85;
        const top = y + height * (1 - Math.max(candle.open, candle.close));
        const bottom = y + height * (1 - Math.min(candle.open, candle.close));
        const up = candle.close >= candle.open;
        return (
          <g
            key={i}
            stroke={up ? upColor : downColor}
            strokeWidth={slot * 0.16}
          >
            <line
              x1={cx}
              y1={top - height * candle.wick}
              x2={cx}
              y2={bottom + height * candle.wick}
              opacity={0.55}
            />
            <line
              x1={cx}
              y1={top}
              x2={cx}
              y2={Math.max(bottom, top + height * 0.012)}
              strokeWidth={slot * 0.5}
            />
          </g>
        );
      })}
      <g
        fontFamily={FONT_MONO}
        fontSize={height * 0.11}
        fill={frameColor}
        textAnchor="end"
        opacity={0.85}
      >
        <text x={x - height * 0.06} y={y + height * 0.14}>
          Q2
        </text>
        <text x={x - height * 0.06} y={y + height * 0.98}>
          Q4
        </text>
      </g>
    </g>
  );
};

export type RadarDialProps = {
  cx: number;
  cy: number;
  radius: number;
  seed: number;
  color?: string;
  accentColor?: string;
  labelColor?: string;
  appearAt?: number;
  opacity?: number;
};

// Segmented index dial: concentric rings, six labelled spokes and a
// sweep hand that rotates once every few seconds.
export const RadarDial: React.FC<RadarDialProps> = ({
  cx,
  cy,
  radius,
  seed,
  color = "#5fb5ee",
  accentColor = "#ffffff",
  labelColor = "rgba(150, 205, 255, 0.72)",
  appearAt = 0,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const reveal = revealAt(frame, appearAt, 30);
  if (reveal <= 0) {
    return null;
  }

  const rand = mulberry32(seed * 577 + 19);
  const spokes = 6;
  const sweep = (frame / 30) * 42;

  return (
    <g opacity={opacity * reveal}>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={radius * 0.05}
        opacity={0.5}
      />
      <circle cx={cx} cy={cy} r={radius * 0.66} fill={color} opacity={0.22} />
      <circle cx={cx} cy={cy} r={radius * 0.3} fill={color} opacity={0.5} />
      <g transform={`rotate(${sweep} ${cx} ${cy})`}>
        <path
          d={`M${cx},${cy} L${cx + radius * 0.92},${cy - radius * 0.3} A${radius * 0.97},${radius * 0.97} 0 0 1 ${cx + radius * 0.92},${cy + radius * 0.3} Z`}
          fill={accentColor}
          opacity={0.16}
        />
      </g>
      {Array.from({ length: spokes }, (_, i) => {
        const deg = (i / spokes) * 360 - 90;
        const rad = (deg * Math.PI) / 180;
        const lit = (Math.sin(frame * 0.08 + rand() * 6) + 1) / 2;
        return (
          <g key={i}>
            <line
              x1={cx + Math.cos(rad) * radius * 0.36}
              y1={cy + Math.sin(rad) * radius * 0.36}
              x2={cx + Math.cos(rad) * radius * 1.05}
              y2={cy + Math.sin(rad) * radius * 1.05}
              stroke={color}
              strokeWidth={radius * 0.06}
              opacity={0.35 + lit * 0.45}
            />
            <text
              x={cx + Math.cos(rad) * radius * 1.55}
              y={cy + Math.sin(rad) * radius * 1.55 + radius * 0.07}
              fill={labelColor}
              fontFamily={FONT_MONO}
              fontSize={radius * 0.2}
              textAnchor="middle"
            >
              {`Index ${i + 1}`}
            </text>
          </g>
        );
      })}
    </g>
  );
};
