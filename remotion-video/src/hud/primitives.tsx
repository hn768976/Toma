import React from "react";
import { useCurrentFrame } from "remotion";
import { useTheme } from "./context";
import { makeRandom, noise1d, randomSeries } from "./rng";

/** Monospaced stack used for every readout on the console. */
export const MONO =
  "'SFMono-Regular', 'DejaVu Sans Mono', 'Liberation Mono', Menlo, Consolas, monospace";

export type Box = { x: number; y: number; w: number; h: number };

/**
 * A framed module on the console surface: hairline border, faint fill, an
 * optional caption in the top-left and tick marks in the corners.
 */
export const Panel: React.FC<{
  box: Box;
  label?: string;
  children?: React.ReactNode;
  /** Corner ticks read as machined hardware; drop them on dense clusters. */
  corners?: boolean;
  fill?: boolean;
}> = ({ box, label, children, corners = true, fill = true }) => {
  const theme = useTheme();
  const { x, y, w, h } = box;
  const tick = Math.min(14, Math.min(w, h) * 0.18);

  return (
    <g>
      {fill ? (
        <rect x={x} y={y} width={w} height={h} fill={theme.surfaceRaised} opacity={0.55} />
      ) : null}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke={theme.hairline}
        strokeWidth={1.2}
      />
      {corners
        ? (
            [
              [x, y, 1, 1],
              [x + w, y, -1, 1],
              [x, y + h, 1, -1],
              [x + w, y + h, -1, -1],
            ] as const
          ).map(([cx, cy, sx, sy], i) => (
            <path
              key={i}
              d={`M ${cx + sx * tick} ${cy} L ${cx} ${cy} L ${cx} ${cy + sy * tick}`}
              fill="none"
              stroke={theme.line}
              strokeWidth={2}
            />
          ))
        : null}
      {label ? (
        <text
          x={x + 9}
          y={y + 16}
          fill={theme.bright}
          fontSize={11}
          fontFamily={MONO}
          letterSpacing={2.2}
          opacity={0.85}
        >
          {label}
        </text>
      ) : null}
      {children}
    </g>
  );
};

/**
 * Illegible filler type. Real HUD footage is mostly text you cannot read, and
 * drawing it as rounded bars keeps the frame busy without inviting the viewer
 * to stop and parse it.
 */
export const TextRows: React.FC<{
  box: Box;
  rows?: number;
  seed: string;
  /** Rows cycle their width on this period, in frames. 0 keeps them static. */
  churn?: number;
}> = ({ box, rows = 6, seed, churn = 0 }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const rowHeight = box.h / rows;
  const widths = randomSeries(`${seed}:w`, rows, 0.25, 1);
  const shades = randomSeries(`${seed}:s`, rows, 0.35, 0.95);

  return (
    <g>
      {widths.map((width, i) => {
        const beat = churn > 0 ? noise1d(`${seed}:${i}`, frame / churn) : 1;
        const w = box.w * width * (churn > 0 ? 0.55 + beat * 0.45 : 1);
        return (
          <rect
            key={i}
            x={box.x}
            y={box.y + i * rowHeight}
            width={Math.max(6, w)}
            height={Math.max(1.6, rowHeight * 0.42)}
            fill={i % 4 === 0 ? theme.bright : theme.mid}
            opacity={shades[i] * 0.75}
          />
        );
      })}
    </g>
  );
};

/** A numeric readout that re-rolls its digits on a fixed cadence. */
export const Ticker: React.FC<{
  x: number;
  y: number;
  seed: string;
  digits?: number;
  decimals?: number;
  /** Frames between value changes. */
  period?: number;
  size?: number;
  color?: string;
  anchor?: "start" | "middle" | "end";
  suffix?: string;
}> = ({
  x,
  y,
  seed,
  digits = 4,
  decimals = 0,
  period = 9,
  size = 13,
  color,
  anchor = "start",
  suffix = "",
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const step = Math.floor(frame / period);
  const random = makeRandom(`${seed}:${step}`);
  const whole = String(Math.floor(random() * 10 ** digits)).padStart(digits, "0");
  const fraction = decimals
    ? `.${String(Math.floor(random() * 10 ** decimals)).padStart(decimals, "0")}`
    : "";

  return (
    <text
      x={x}
      y={y}
      fill={color ?? theme.hot}
      fontSize={size}
      fontFamily={MONO}
      textAnchor={anchor}
      letterSpacing={1}
    >
      {whole}
      {fraction}
      {suffix}
    </text>
  );
};

/** Small caps caption. */
export const Label: React.FC<{
  x: number;
  y: number;
  children: string;
  size?: number;
  color?: string;
  anchor?: "start" | "middle" | "end";
  opacity?: number;
  tracking?: number;
}> = ({ x, y, children, size = 12, color, anchor = "start", opacity = 0.9, tracking = 2 }) => {
  const theme = useTheme();
  return (
    <text
      x={x}
      y={y}
      fill={color ?? theme.bright}
      fontSize={size}
      fontFamily={MONO}
      textAnchor={anchor}
      letterSpacing={tracking}
      opacity={opacity}
    >
      {children}
    </text>
  );
};

/** Background graph paper for a panel's plot area. */
export const Grid: React.FC<{ box: Box; cols?: number; rows?: number; opacity?: number }> = ({
  box,
  cols = 8,
  rows = 4,
  opacity = 0.5,
}) => {
  const theme = useTheme();
  const vertical = Array.from({ length: cols - 1 }, (_, i) => box.x + (box.w / cols) * (i + 1));
  const horizontal = Array.from({ length: rows - 1 }, (_, i) => box.y + (box.h / rows) * (i + 1));

  return (
    <g stroke={theme.hairline} strokeWidth={0.8} opacity={opacity}>
      {vertical.map((x) => (
        <line key={`v${x}`} x1={x} y1={box.y} x2={x} y2={box.y + box.h} />
      ))}
      {horizontal.map((y) => (
        <line key={`h${y}`} x1={box.x} y1={y} x2={box.x + box.w} y2={y} />
      ))}
    </g>
  );
};

/** A run of ticks along an edge, like a ruler on a scope. */
export const TickStrip: React.FC<{
  box: Box;
  count?: number;
  orientation?: "horizontal" | "vertical";
  seed?: string;
}> = ({ box, count = 24, orientation = "horizontal", seed = "ticks" }) => {
  const theme = useTheme();
  const lengths = randomSeries(seed, count, 0.35, 1);

  return (
    <g stroke={theme.line} strokeWidth={1}>
      {lengths.map((length, i) => {
        const t = (i + 0.5) / count;
        const long = i % 5 === 0;
        const size = (orientation === "horizontal" ? box.h : box.w) * (long ? 1 : length * 0.6);
        return orientation === "horizontal" ? (
          <line
            key={i}
            x1={box.x + box.w * t}
            y1={box.y + box.h}
            x2={box.x + box.w * t}
            y2={box.y + box.h - size}
            opacity={long ? 0.9 : 0.5}
          />
        ) : (
          <line
            key={i}
            x1={box.x}
            y1={box.y + box.h * t}
            x2={box.x + size}
            y2={box.y + box.h * t}
            opacity={long ? 0.9 : 0.5}
          />
        );
      })}
    </g>
  );
};
