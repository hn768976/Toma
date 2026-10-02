import React from "react";
import { textStyle } from "./Stage";

// Small SVG primitives shared by all looks. All sizes are design units
// (1920 x 1080 grid), see Stage.tsx.

type TxtProps = {
  x: number;
  y: number;
  size: number;
  fill: string;
  mono?: boolean;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  ls?: number; // letter spacing in design units
  opacity?: number;
  filter?: string;
  children: React.ReactNode;
};

export const Txt: React.FC<TxtProps> = ({
  x,
  y,
  size,
  fill,
  mono = false,
  weight = 400,
  anchor = "start",
  ls = 0,
  opacity,
  filter,
  children,
}) => (
  <text
    x={x}
    y={y}
    fontSize={size}
    fill={fill}
    fontWeight={weight}
    textAnchor={anchor}
    letterSpacing={ls}
    opacity={opacity}
    filter={filter}
    style={textStyle(mono)}
  >
    {children}
  </text>
);

/** Circular gauge: track + arc from 12 o'clock, clockwise. value in [0,1]. */
export const RingGauge: React.FC<{
  cx: number;
  cy: number;
  r: number;
  w: number;
  value: number;
  color: string;
  track: string;
  filter?: string;
  cap?: "round" | "butt";
}> = ({ cx, cy, r, w, value, color, track, filter, cap = "round" }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={w} />
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={w}
      pathLength={1000}
      strokeDasharray={`${Math.max(0.001, value) * 1000} 1000`}
      strokeLinecap={cap}
      transform={`rotate(-90 ${cx} ${cy})`}
      filter={filter}
    />
  </g>
);

/** Polyline through values in [0,1] spread across w x h. */
export const sparkPoints = (vals: number[], x: number, y: number, w: number, h: number) =>
  vals
    .map((v, i) => `${(x + (i / (vals.length - 1)) * w).toFixed(2)},${(y + h - v * h).toFixed(2)}`)
    .join(" ");

/**
 * A scrolling chart window over a periodic series. `pos` is the series
 * index at the left edge (fractional); the series wraps, so a pos that
 * advances by a whole multiple of series.length over the loop is seamless.
 */
export const windowSeries = (series: number[], pos: number, count: number) => {
  const n = series.length;
  const out: number[] = [];
  const base = Math.floor(pos);
  const fr = pos - base;
  for (let i = 0; i <= count; i++) {
    const a = series[(((base + i) % n) + n) % n];
    const b = series[(((base + i + 1) % n) + n) % n];
    out.push(a + (b - a) * fr);
  }
  return out;
};

/** Rounded panel rectangle. */
export const PanelRect: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  fill: string;
  stroke: string;
  sw?: number;
  opacity?: number;
  filter?: string;
}> = ({ x, y, w, h, r = 8, fill, stroke, sw = 1, opacity, filter }) => (
  <rect
    x={x + sw / 2}
    y={y + sw / 2}
    width={w - sw}
    height={h - sw}
    rx={r}
    fill={fill}
    stroke={stroke}
    strokeWidth={sw}
    opacity={opacity}
    filter={filter}
  />
);

/** Text clipped to a rectangle; children drawn in a translated group. */
export const Clip: React.FC<{ id: string; x: number; y: number; w: number; h: number; children: React.ReactNode }> = ({
  id,
  x,
  y,
  w,
  h,
  children,
}) => (
  <g>
    <defs>
      <clipPath id={id}>
        <rect x={x} y={y} width={w} height={h} />
      </clipPath>
    </defs>
    <g clipPath={`url(#${id})`}>{children}</g>
  </g>
);

/** Hex / rgb colour mixing for palette interpolation. */
const parse = (c: string): [number, number, number] => {
  if (c.startsWith("rgb")) {
    const m = c.match(/[\d.]+/g) ?? ["0", "0", "0"];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  }
  const h = c.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
export const mix = (a: string, b: string, t: number) => {
  const A = parse(a);
  const B = parse(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};
