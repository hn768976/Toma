import React from "react";
import { Easing, interpolate } from "remotion";
import { boot, code, digits, glitch, roam } from "../lib/anim";
import { Palette } from "../palette";
import { G, Txt } from "./primitives";

const ease = Easing.inOut(Easing.sin);
const kf = (t: number, times: number[], values: number[]) =>
  interpolate(t, times, values, { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

// Reticle keyframes (seconds), measured from the reference: it sits left of
// centre, sweeps to the right, shrinks a little and exits frame right by ~27 s.
const RT = [1.3, 2.0, 6, 12, 18, 21, 24, 27, 30];
const RX = [600, 610, 612, 1035, 1525, 1680, 2050, 2450, 2600];
const RY = [555, 550, 540, 525, 575, 480, 500, 520, 520];
const RR = [360, 360, 355, 350, 300, 300, 290, 280, 280];

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

type Blk = [number, number, number, number, number]; // x, y, lines, start(s), end(s)
const BLOCKS: Blk[] = [
  [440, 660, 5, 0.35, 99],
  [905, 345, 3, 0.4, 99],
  [1625, 770, 3, 0.45, 99],
  [1640, 140, 4, 0.3, 99],
  [500, 290, 2, 0.5, 12],
  [1180, 470, 3, 0.6, 18],
  [250, 470, 3, 2.5, 99],
  [1350, 880, 2, 0.8, 99],
  [760, 160, 2, 1.0, 99],
  [1060, 760, 3, 4.0, 20],
  [1500, 330, 3, 8.0, 99],
  [620, 780, 2, 14.0, 99],
];

export const Center: React.FC<{ frame: number; p: Palette }> = ({ frame, p }) => {
  const t = frame / 30;
  const cx = kf(t, RT, RX);
  const cy = kf(t, RT, RY);
  const grow = interpolate(t, [1.3, 2.0], [0.55, 1], { easing: Easing.out(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const R = kf(t, RT, RR) * grow;
  const ret = boot(frame, 39);
  // crosshair rides with the reticle but parks at the right edge once the
  // reticle has left frame (as in the reference's final seconds)
  const hx = Math.min(cx - R * 0.55 + Math.sin(t * 0.4) * 40, 1872);
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
          <g transform={`rotate(${-rot * 0.35 + 12})`}>
            <circle r={R * 1.3} fill="none" stroke={p.line} strokeWidth={1} opacity={0.4} strokeDasharray={`${R * 0.04} ${R * 0.035}`} />
            <circle r={R * 1.3} fill="none" stroke={p.text} strokeWidth={2} opacity={0.5} strokeDasharray={`${R * 0.5} ${R * 1.1} ${R * 0.2} ${R * 6.3}`} />
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

      {/* floating multi-line data blocks */}
      {BLOCKS.map(([x0, y0, n, s0, e], i) => {
        const rm = roam(t, 4600 + i, 5 + (i % 4));
        const x = x0 + rm.dx;
        const y = y0 + rm.dy;
        return (
        <G key={`b${i}`} o={boot(frame, Math.round(s0 * 30), Math.round(e * 30), 15) * glitch(frame, 4000 + i, 0.02) * rm.o}>
          {Array.from({ length: n }, (_, k) => (
            <Txt key={k} x={x + (k === 0 ? 0 : 10)} y={y + k * 11} size={k === 0 ? 8 : 7} fill={p.text} opacity={k === 0 ? 0.75 : 0.5}>
              {k === 0 ? `■ ${code(4100 + i, 8, rm.slot)} ${code(4200 + i, 5)}` : `${code(4300 + i * 7 + k, 4, rm.slot)}  ${digits(4400 + i * 7 + k, 6, k === 1 ? step8 : rm.slot)}  ${code(4500 + i * 7 + k, 3)}`}
            </Txt>
          ))}
        </G>
        );
      })}

      {/* floating annotation labels */}
      {LABELS.map(([x0, y0, s, e], i) => {
        const rm = roam(t, 4800 + i, 6 + (i % 3));
        const x = x0 + rm.dx;
        const y = y0 + rm.dy;
        return (
          <G key={i} o={boot(frame, Math.round(s * 30), Math.round(e * 30), 15) * glitch(frame, 3600 + i, 0.02) * rm.o}>
            <Txt x={x} y={y} size={8} fill={p.text} opacity={0.7}>{`▸ ${code(3700 + i, 9, rm.slot)} ${code(3800 + i, 4)} ${digits(3900 + i, 4, i % 2 ? step8 : rm.slot)}`}</Txt>
            <rect x={x} y={y + 5} width={60} height={1} fill={p.line} opacity={0.4} />
          </G>
        );
      })}
    </g>
  );
};
