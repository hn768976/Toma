// HUD widgets drawn as DOM/SVG over the WebGL canvas. Sizes are in
// composition pixels (3840 x 2160). Every changing value comes from a seeded
// table indexed by a hold schedule whose step divides 600, so the HUD loops.

import React from "react";
import { MONO, SANS } from "../lib/fonts";
import { holdIndex, LOOP, loopFrame, phase } from "../lib/loop";
import { code, digits, hash01, hex, mulberry32 } from "../lib/random";

export interface HudTheme {
  text: string;
  dim: string;
  accent: string;
  line: string;
}

// value of a seeded schedule: changes every `hold` frames, loops on 600
export const tick = (f: number, seed: number, hold: number) => hash01(seed, holdIndex(f, hold) % (LOOP / hold));

export const Txt: React.FC<{
  x: number;
  y: number;
  size?: number;
  color: string;
  children: React.ReactNode;
  weight?: number;
  sans?: boolean;
  opacity?: number;
  spacing?: number;
  align?: "left" | "right";
  width?: number;
}> = ({ x, y, size = 22, color, children, weight = 400, sans, opacity = 1, spacing = 0.04, align = "left", width }) => (
  <div
    style={{
      position: "absolute",
      left: align === "right" && width ? x - width : x,
      top: y,
      width,
      textAlign: align,
      fontFamily: sans ? SANS : MONO,
      fontSize: size,
      fontWeight: weight,
      color,
      opacity,
      letterSpacing: `${spacing}em`,
      lineHeight: 1,
      whiteSpace: "pre",
    }}
  >
    {children}
  </div>
);

// Rows of random codes; each row re-rolls on its own schedule.
export const CodeLines: React.FC<{
  f: number;
  x: number;
  y: number;
  rows: number;
  seed: number;
  size?: number;
  gap?: number;
  theme: HudTheme;
  cols?: number[]; // char counts per column
  colGap?: number;
  holds?: number[];
  dimCols?: number[];
}> = ({ f, x, y, rows, seed, size = 20, gap = 1.55, theme, cols = [6, 12, 4], colGap = 1.2, holds = [12, 20, 30, 60], dimCols = [0] }) => {
  const out: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const hold = holds[Math.floor(hash01(seed, r, 7) * holds.length)];
    const step = holdIndex(f, hold) % (LOOP / hold);
    const rng = mulberry32(Math.floor(hash01(seed, r, step) * 1e9));
    let cx = x;
    cols.forEach((n, c) => {
      const s = c === 0 ? hex(rng, n) : rng() < 0.5 ? code(rng, n) : digits(rng, n);
      out.push(
        <Txt key={`${r}-${c}`} x={cx} y={y + r * size * gap} size={size} color={dimCols.includes(c) ? theme.dim : theme.text}>
          {s}
        </Txt>,
      );
      cx += (n + colGap) * size * 0.6;
    });
  }
  return <>{out}</>;
};

export const Rect: React.FC<{ x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; opacity?: number; r?: number }> = ({
  x,
  y,
  w,
  h,
  fill = "none",
  stroke,
  sw = 2,
  opacity = 1,
  r = 0,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      background: fill,
      border: stroke ? `${sw}px solid ${stroke}` : undefined,
      boxSizing: "border-box",
      opacity,
      borderRadius: r,
    }}
  />
);

// Horizontal bars whose lengths change on a schedule.
export const Bars: React.FC<{
  f: number;
  x: number;
  y: number;
  w: number;
  n: number;
  h?: number;
  gap?: number;
  seed: number;
  color: string;
  track?: string;
  hold?: number;
  min?: number;
}> = ({ f, x, y, w, n, h = 10, gap = 8, seed, color, track, hold = 20, min = 0.15 }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const v = min + (1 - min) * tick(f, seed + i * 13, hold);
      return (
        <React.Fragment key={i}>
          {track && <Rect x={x} y={y + i * (h + gap)} w={w} h={h} fill={track} />}
          <Rect x={x} y={y + i * (h + gap)} w={w * v} h={h} fill={color} />
        </React.Fragment>
      );
    })}
  </>
);

// Vertical bar chart.
export const BarChart: React.FC<{ f: number; x: number; y: number; w: number; h: number; n: number; seed: number; color: string; hold?: number }> = ({
  f,
  x,
  y,
  w,
  h,
  n,
  seed,
  color,
  hold = 15,
}) => {
  const bw = w / n;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const v = 0.15 + 0.85 * tick(f, seed + i * 31, hold);
        return <Rect key={i} x={x + i * bw} y={y + h * (1 - v)} w={bw * 0.6} h={h * v} fill={color} />;
      })}
    </>
  );
};

// Small round dial: track ring, turning arc, tick, number.
export const Dial: React.FC<{ f: number; x: number; y: number; r: number; seed: number; theme: HudTheme; cycles?: number; showNum?: boolean }> = ({
  f,
  x,
  y,
  r,
  seed,
  theme,
  cycles = 1,
  showNum = false,
}) => {
  const a = phase(f, cycles) * (hash01(seed) < 0.5 ? 1 : -1) + hash01(seed, 1) * 6.28;
  const sweep = 0.9 + 1.6 * hash01(seed, 2);
  const arc = (r0: number, a0: number, a1: number) => {
    const p0 = [x + r0 * Math.cos(a0), y + r0 * Math.sin(a0)];
    const p1 = [x + r0 * Math.cos(a1), y + r0 * Math.sin(a1)];
    return `M ${p0[0]} ${p0[1]} A ${r0} ${r0} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1[0]} ${p1[1]}`;
  };
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={theme.dim} strokeWidth={r * 0.12} opacity={0.6} />
      <path d={arc(r, a, a + sweep)} fill="none" stroke={theme.text} strokeWidth={r * 0.2} />
      <line x1={x} y1={y - r * 0.75} x2={x} y2={y - r * 1.25} stroke={theme.text} strokeWidth={r * 0.1} />
      <circle cx={x} cy={y} r={r * 0.18} fill={theme.text} />
      {showNum && (
        <text x={x} y={y + r * 1.9} fill={theme.text} fontFamily={MONO} fontSize={r * 0.7} textAnchor="middle">
          {String(Math.floor(tick(f, seed + 3, 30) * 100)).padStart(2, "0")}
        </text>
      )}
    </g>
  );
};

// Thin segmented bar strip.
export const SegStrip: React.FC<{ f: number; x: number; y: number; w: number; h: number; seed: number; color: string; dim: string; n?: number; hold?: number }> = ({
  f,
  x,
  y,
  w,
  h,
  seed,
  color,
  dim,
  n = 60,
  hold = 10,
}) => {
  const sw = w / n;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const on = tick(f, seed + i * 7, hold) > 0.45;
        return <Rect key={i} x={x + i * sw} y={y} w={sw * 0.7} h={h} fill={on ? color : dim} opacity={on ? 1 : 0.5} />;
      })}
    </>
  );
};

// A frame of corner brackets.
export const Brackets: React.FC<{ x: number; y: number; w: number; h: number; len: number; color: string; sw?: number }> = ({ x, y, w, h, len, color, sw = 3 }) => (
  <path
    d={`M ${x} ${y + len} V ${y} H ${x + len} M ${x + w - len} ${y} H ${x + w} V ${y + len} M ${x + w} ${y + h - len} V ${y + h} H ${x + w - len} M ${x + len} ${y + h} H ${x} V ${y + h - len}`}
    fill="none"
    stroke={color}
    strokeWidth={sw}
  />
);

export const Svg: React.FC<{ children: React.ReactNode; w?: number; h?: number }> = ({ children, w = 3840, h = 2160 }) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
    {children}
  </svg>
);

// Counter that ticks: integer value from a seeded random walk on a schedule.
export const counterValue = (f: number, seed: number, hold: number, lo: number, hi: number) =>
  Math.floor(lo + (hi - lo + 1) * tick(f, seed, hold));

// Blinking: on/off by schedule (loop-safe).
export const blink = (f: number, seed: number, hold: number, duty = 0.5) => tick(f, seed, hold) < duty;

export const pad = (n: number, w: number) => String(n).padStart(w, "0");

export const lf = loopFrame;
