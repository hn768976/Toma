import React from "react";
import { Easing, interpolate } from "remotion";
import { boot, code, digits, glitch } from "../lib/anim";
import { Palette } from "../palette";
import { G, Txt } from "./primitives";

const ease = Easing.inOut(Easing.sin);
const kf = (t: number, times: number[], values: number[]) =>
  interpolate(t, times, values, { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

// Reticle keyframes (seconds) - drifts left -> centre -> right and shrinks.
const RT = [1.4, 6, 10, 14, 18, 22, 26, 30];
const RX = [520, 610, 760, 1000, 1430, 1520, 1480, 1640];
const RY = [560, 540, 580, 560, 600, 560, 600, 600];
const RR = [310, 300, 285, 270, 250, 232, 212, 190];

type Sq = [number, number, number, number, number, number];
const SQUARES: Sq[] = [
  [470, 300, 340, 410, 1.8, 8.5],
  [860, 290, 330, 420, 6.0, 15.0],
  [300, 330, 380, 420, 9.0, 13.0],
  [720, 300, 360, 400, 12.5, 20.5],
  [1150, 300, 330, 420, 17.5, 25.0],
  [640, 360, 320, 380, 22.0, 27.5],
  [640, 610, 100, 110, 2.6, 7.0],
  [400, 640, 90, 95, 4.0, 9.5],
  [560, 420, 80, 85, 8.0, 12.0],
  [1040, 640, 100, 100, 11.0, 16.0],
  [430, 380, 110, 100, 14.5, 21.5],
  [1230, 600, 100, 95, 19.0, 25.5],
  [860, 400, 80, 90, 23.0, 28.0],
  [300, 560, 120, 120, 25.0, 99],
  [1020, 330, 300, 380, 27.0, 99],
];

type Lb = [number, number, number, number];
const LABELS: Lb[] = [
  [1070, 128, 1.2, 99],
  [470, 260, 2.2, 9],
  [820, 700, 3.0, 11],
  [300, 790, 5.0, 14],
  [1100, 420, 7.5, 16],
  [600, 860, 9.5, 18],
  [1250, 760, 12.0, 21],
  [380, 300, 15.0, 24],
  [1500, 420, 17.0, 27],
  [900, 830, 20.0, 99],
  [700, 250, 23.0, 99],
  [1300, 260, 25.5, 99],
  [180, 700, 1.6, 99],
];

export const Center: React.FC<{ frame: number; p: Palette }> = ({ frame, p }) => {
  const t = frame / 30;
  const cx = kf(t, RT, RX);
  const cy = kf(t, RT, RY);
  const grow = interpolate(t, [1.4, 2.1], [0.55, 1], { easing: Easing.out(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const R = kf(t, RT, RR) * grow;
  const ret = boot(frame, 42);
  const hx = cx - R * 0.55 + Math.sin(t * 0.4) * 40;
  const hy = cy - R * 0.5 + Math.cos(t * 0.33) * 30;
  const rot = t * 9;
  const step8 = Math.floor(frame / 8);

  return (
    <g>
      {/* translucent squares */}
      {SQUARES.map(([x, y, w, h, s, e], i) => {
        const o = boot(frame, Math.round(s * 30), Math.round(e * 30), 18) * glitch(frame, 3000 + i, 0.02);
        if (o <= 0) return null;
        const small = w < 150;
        const sc = interpolate(frame - s * 30, [0, 10], [0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <G key={i} o={o} transform={`translate(${x + w / 2} ${y + h / 2}) scale(${sc}) translate(${-w / 2} ${-h / 2})`}>
            <rect width={w} height={h} fill={p.panel} opacity={small ? 0.22 : 0.15} />
            <rect width={w} height={h} fill="none" stroke={p.line} strokeWidth={1} opacity={0.15} />
            {!small && (
              <>
                <path d={`M 0 14 V 0 H 14 M ${w - 14} 0 H ${w} V 14 M ${w} ${h - 14} V ${h} H ${w - 14} M 14 ${h} H 0 V ${h - 14}`} fill="none" stroke={p.line} strokeWidth={1.2} opacity={0.5} />
                <Txt x={6} y={h + 14} size={7.5} fill={p.text} opacity={0.6}>{`▸ ${code(3100 + i, 6)} ${digits(3200 + i, 4, step8)}`}</Txt>
              </>
            )}
          </G>
        );
      })}

      {/* crosshair lines */}
      <G o={ret * 0.9}>
        <rect x={0} y={hy} width={1920} height={1} fill={p.line} opacity={0.3} />
        <rect x={hx} y={110} width={1} height={940} fill={p.line} opacity={0.3} />
        <path d={`M ${hx - 9} ${hy} H ${hx - 3} M ${hx + 3} ${hy} H ${hx + 9} M ${hx} ${hy - 9} V ${hy - 3} M ${hx} ${hy + 3} V ${hy + 9}`} stroke={p.text} strokeWidth={1.5} />
        <rect x={hx - 2} y={hy - 2} width={4} height={4} fill={p.accent} opacity={0.9} />
        <Txt x={hx + 14} y={hy - 8} size={8} fill={p.text} opacity={0.75}>{`TARGET ${digits(3300, 2)} IN RANGE`}</Txt>
        <Txt x={hx + 14} y={hy + 16} size={7.5} fill={p.text} opacity={0.55}>{`X ${Math.round(hx)}  Y ${Math.round(hy)}`}</Txt>
      </G>
      {/* secondary scan line */}
      <G o={boot(frame, 240, 760, 40) * 0.8}>
        <rect x={0} y={kf(t, [8, 25], [420, 680])} width={1920} height={1} fill={p.line} opacity={0.22} />
      </G>

      {/* reticle */}
      <G o={ret}>
        <g transform={`translate(${cx} ${cy})`}>
          <g transform={`rotate(${rot})`}>
            <circle r={R} fill="none" stroke={p.line} strokeWidth={1.3} opacity={0.55} strokeDasharray={`${R * 0.9} ${R * 0.05} ${R * 0.25} ${R * 0.05} ${R * 0.5} ${R * 0.12}`} />
          </g>
          <g transform={`rotate(${-rot * 1.6 + 40})`}>
            <circle r={R * 0.62} fill="none" stroke={p.line} strokeWidth={1} opacity={0.4} strokeDasharray={`${R * 0.5} ${R * 0.35} ${R * 0.12} ${R * 0.9}`} />
          </g>
          <g transform={`rotate(${rot * 0.5})`}>
            <circle r={R + 10} fill="none" stroke={p.text} strokeWidth={2.4} opacity={0.6} strokeDasharray={`${R * 0.08} ${R * 1.5}`} />
          </g>
          {[0, 90, 180, 270].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <rect x={-0.6} y={-R - 8} width={1.2} height={16} fill={p.text} opacity={0.8} />
            </g>
          ))}
          <circle r={6} fill="none" stroke={p.text} strokeWidth={1} opacity={0.7} />
          <path d="M -12 0 H -7 M 7 0 H 12 M 0 -12 V -7 M 0 7 V 12" stroke={p.text} strokeWidth={1} opacity={0.8} />
          <Txt x={-R * 0.35} y={R + 22} size={8} fill={p.text} opacity={0.7}>{`RADIUS ${Math.round(R)}  SECTOR ${digits(3400, 3)}`}</Txt>
          <Txt x={R * 0.72} y={-R * 0.72} size={8} fill={p.text} opacity={0.65}>{`▸ ${code(3500, 8)} ${digits(3501, 4, step8)}`}</Txt>
        </g>
      </G>

      {/* floating annotation labels */}
      {LABELS.map(([x, y, s, e], i) => (
        <G key={i} o={boot(frame, Math.round(s * 30), Math.round(e * 30), 15) * glitch(frame, 3600 + i, 0.02)}>
          <Txt x={x} y={y} size={8} fill={p.text} opacity={0.7}>{`▸ ${code(3700 + i, 9)} ${code(3800 + i, 4)} ${digits(3900 + i, 4, i % 2 ? step8 : 0)}`}</Txt>
          <rect x={x} y={y + 5} width={60} height={1} fill={p.line} opacity={0.4} />
        </G>
      ))}
    </g>
  );
};
