import React from "react";
import { DESIGN_HEIGHT as H, DESIGN_WIDTH as W, FONT_LABEL, FONT_MONO } from "../common/constants";
import { easeOut, flickerIn, ramp } from "../common/math";
import { Camera, project } from "./camera";
import { CrossMarker, CrossNode, DotMarker, LetterBadge } from "./icons";
import { SatellitePalette } from "./palette";
import { CLOSE_TARGET, SatelliteVariant, T } from "./timeline";

const R = 360; // reticle radius, design px
const NODE_ANGLES = [-150, -112, -62, -24, 12, 52, 100, 128, 158, 196];
// Inner relay points (fraction of R) joined to the centre by dashed lines.
const RELAYS: { a: number; f: number; to: "center" | "left" | "right" | "bottom" }[] = [
  { a: 180, f: 0.62, to: "center" },
  { a: -6, f: 0.62, to: "center" },
  { a: 90, f: 0.5, to: "center" },
];

// Field-centre markers in world coordinates.
const FIELD_MARKERS = [
  { x: -2.4, y: 2.4 },
  { x: 0.8, y: 2.4 },
  { x: -3.9, y: -2.4 },
  { x: 0.8, y: -0.8 },
  { x: 2.4, y: 0.8 },
  { x: -0.8, y: -4.0 },
  { x: 4.0, y: 4.0 },
];

// Secondary contacts on the right of the close-up, world coordinates.
const CONTACTS = [
  { x: 5.2, y: 3.2 },
  { x: 5.6, y: 1.2 },
  { x: 4.6, y: -0.9 },
  { x: 5.0, y: -2.6 },
];

export const CloseHud: React.FC<{
  frame: number;
  cam: Camera;
  variant: SatelliteVariant;
  palette: SatellitePalette;
}> = ({ frame, cam, palette }) => {
  if (frame < T.zoomEnd - 6) return null;
  const c = project(cam, CLOSE_TARGET.x, CLOSE_TARGET.y, W, H);
  if (!c) return null;
  const ring = ramp(frame, T.lockOn, T.lockOn + 14, easeOut);
  const nodes = (i: number) => flickerIn(frame, T.lockOn + 6 + i * 1.5, i);
  const brackets = ramp(frame, T.lockOn - 4, T.lockOn + 10, easeOut);
  const big = ramp(frame, T.lockOn + 12, T.lockOn + 20, easeOut);
  const iconA = flickerIn(frame, T.iconA, 9);
  const link = ramp(frame, T.iconA + 4, T.iconA + 16, easeOut);
  const bar = ramp(frame, T.iconA + 6, T.iconA + 18, easeOut);
  const hostile = frame >= T.hostile;
  const hostileFlash = hostile && frame < T.hostile + 10 ? (Math.floor((frame - T.hostile) / 2) % 2 ? 0.4 : 1) : 1;
  const fieldIn = ramp(frame, T.zoomEnd + 10, T.zoomEnd + 26);

  const pt = (a: number, f = 1) => ({
    x: c.x + Math.cos((a * Math.PI) / 180) * R * f,
    y: c.y + Math.sin((a * Math.PI) / 180) * R * f,
  });
  const left = pt(180);
  const right = pt(-10);
  const bottom = pt(88);
  const sideColor = hostile ? palette.red : palette.white;

  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {/* Field markers locked to the ground */}
      {FIELD_MARKERS.map((m, i) => {
        const p = project(cam, m.x, m.y, W, H);
        if (!p) return null;
        return <CrossMarker key={i} x={p.x} y={p.y} r={6} color={palette.white} opacity={fieldIn * 0.8} />;
      })}
      {/* Short cyan ticks */}
      <g opacity={0.7 * fieldIn}>
        {[
          [120, 60],
          [400, 300],
          [1260, 140],
          [1650, 480],
          [260, 820],
          [1480, 900],
        ].map(([x, y], i) => (
          <line key={i} x1={x} y1={y} x2={x + 24} y2={y} stroke={palette.cyan} strokeWidth={3} />
        ))}
      </g>
      {/* Corner brackets */}
      <g stroke={palette.amber} strokeWidth={4} fill="none" opacity={brackets}>
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sy], i) => {
          const s = 430 + (1 - brackets) * 60;
          const x = c.x - 40 + sx * s;
          const y = c.y - 30 + sy * s * 0.92;
          return <path key={i} d={`M${x} ${y - sy * 70}L${x} ${y}L${x - sx * 70} ${y}`} />;
        })}
      </g>
      {/* Reticle ring */}
      <circle
        cx={c.x}
        cy={c.y}
        r={R}
        fill="none"
        stroke={palette.white}
        strokeWidth={4.5}
        pathLength={1}
        strokeDasharray={`${ring} 1`}
        transform={`rotate(180 ${c.x} ${c.y})`}
      />
      {NODE_ANGLES.map((a, i) => {
        const p = pt(a);
        return <circle key={i} cx={p.x} cy={p.y} r={13} fill="rgba(12,16,20,0.6)" stroke={palette.white} strokeWidth={4.5} opacity={nodes(i)} />;
      })}
      {/* Relays and dashed links */}
      {RELAYS.map((r, i) => {
        const p = pt(r.a, r.f);
        const o = nodes(i + 3);
        return (
          <g key={i} opacity={o}>
            <line x1={p.x} y1={p.y} x2={c.x} y2={c.y} stroke={palette.white} strokeWidth={2} strokeDasharray="4 6" opacity={0.85} />
            <circle cx={p.x} cy={p.y} r={12} fill="rgba(12,16,20,0.6)" stroke={palette.white} strokeWidth={4.5} />
          </g>
        );
      })}
      <line x1={right.x} y1={right.y} x2={pt(-6, 0.62).x} y2={pt(-6, 0.62).y} stroke={palette.white} strokeWidth={2} strokeDasharray="3 5" opacity={big} />
      <line x1={bottom.x} y1={bottom.y} x2={pt(90, 0.5).x} y2={pt(90, 0.5).y} stroke={palette.white} strokeWidth={2} strokeDasharray="3 5" opacity={big} />
      {/* Key nodes */}
      <g transform={`translate(${left.x} ${left.y}) scale(${0.6 + 0.4 * big})`}>
        <circle r={40} fill="none" stroke={palette.amber} strokeWidth={8} opacity={big} />
        <CrossNode x={0} y={0} r={24} color={palette.white} opacity={big} />
      </g>
      <g opacity={hostileFlash}>
        <CrossNode x={right.x} y={right.y} r={30} color={sideColor} opacity={big} double={!hostile} />
        <CrossNode x={bottom.x} y={bottom.y} r={30} color={sideColor} opacity={big} double={!hostile} />
      </g>
      {/* Centre target */}
      <DotMarker x={c.x} y={c.y} r={12} core={palette.red} opacity={ring} />
      {/* Amber pulses */}
      {T.pulses.map((p0, i) => {
        const t = ramp(frame, p0, p0 + 22);
        if (t <= 0 || t >= 1) return null;
        const o = Math.sin(t * Math.PI);
        return (
          <g key={i} opacity={o}>
            <circle cx={c.x} cy={c.y} r={R * (1.02 + 0.06 * t)} fill="none" stroke={palette.amber} strokeWidth={6} opacity={0.75} />
            <circle cx={c.x} cy={c.y} r={R * (1.1 + 0.04 * t)} fill="none" stroke={palette.amber} strokeWidth={2} opacity={0.6} />
            <circle cx={c.x} cy={c.y} r={R * (1.02 + 0.06 * t)} fill="none" stroke={palette.amber} strokeWidth={20} opacity={0.12} />
          </g>
        );
      })}
      {/* Link to the "A" badge */}
      <LetterBadge x={28} y={c.y - 215} letter="A" color={palette.amber} opacity={iconA} spin={frame} r={30} />
      <polyline
        points={`${62} ${c.y - 205} ${left.x - 120} ${c.y - 120} ${left.x - 22} ${left.y}`}
        fill="none"
        stroke={palette.white}
        strokeWidth={1.6}
        opacity={0.8}
        pathLength={1}
        strokeDasharray={`${link} 1`}
      />
      <g transform={`translate(${c.x + R * 0.62} ${c.y - R * 0.78})`} opacity={bar}>
        <rect width={190 * bar} height={13} fill={palette.amber} />
        <text y={-6} fontFamily={FONT_MONO} fontSize={9} fill={palette.white} opacity={0.9}>
          TRK 0417 / LOCK
        </text>
      </g>
      {/* Node captions */}
      <g fontFamily={FONT_MONO} fontSize={12} fill={palette.white} opacity={big * 0.85}>
        <text x={left.x + 18} y={left.y + 28}>N-01 / 2.41</text>
        <text x={right.x + 22} y={right.y + 4}>N-04 / 1.87</text>
        <text x={bottom.x + 24} y={bottom.y + 4}>N-07 / 3.02</text>
        <text x={c.x + 14} y={c.y + 22}>OBJ 61</text>
      </g>
      {/* Secondary contacts */}
      {CONTACTS.map((m, i) => {
        const p = project(cam, m.x, m.y, W, H);
        if (!p) return null;
        const o = flickerIn(frame, T.contacts + i * 5, i + 20);
        return hostile ? (
          <g key={i} opacity={o * hostileFlash}>
            <DotMarker x={p.x} y={p.y} r={9} core={palette.red} rim={palette.white} opacity={1} />
            <circle cx={p.x} cy={p.y} r={24} fill="none" stroke={palette.red} strokeWidth={1.5} opacity={0.6} />
          </g>
        ) : (
          <g key={i} opacity={o}>
            <circle cx={p.x} cy={p.y} r={14} fill="none" stroke={palette.white} strokeWidth={3} />
            <circle cx={p.x} cy={p.y} r={22} fill="none" stroke={palette.white} strokeWidth={1.5} strokeDasharray="3 5" />
            <circle cx={p.x} cy={p.y} r={5} fill={palette.white} />
          </g>
        );
      })}
      <text
        x={1880}
        y={60}
        textAnchor="end"
        fontFamily={FONT_LABEL}
        fontSize={20}
        fill={palette.white}
        opacity={0.7 * fieldIn}
        letterSpacing={2}
      >
        ZOOM 5.6X · SECTOR 61-A
      </text>
    </svg>
  );
};
