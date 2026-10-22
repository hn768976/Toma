import React from "react";
import { DESIGN_HEIGHT as H, DESIGN_WIDTH as W, FONT_LABEL, FONT_MONO } from "../common/constants";
import { easeOut, flickerIn, ramp, rng } from "../common/math";
import { Camera, project } from "./camera";
import { CrossMarker, DotMarker, LetterBadge } from "./icons";
import { SatellitePalette } from "./palette";
import { SatelliteVariant, T, WIDE_TARGET } from "./timeline";

// Secondary markers inside the lens, in world units relative to the target.
const LENS_MARKERS: { dx: number; dy: number; kind: "amber" | "red" | "redRing" | "white" | "cross" | "square" }[] = [
  { dx: -3.2, dy: -0.6, kind: "amber" },
  { dx: 0.1, dy: -2.2, kind: "red" },
  { dx: 2.4, dy: 0.2, kind: "redRing" },
  { dx: 1.6, dy: -5.0, kind: "redRing" },
  { dx: 3.6, dy: -1.6, kind: "white" },
  { dx: -0.6, dy: 4.4, kind: "white" },
  { dx: -4.4, dy: 3.2, kind: "cross" },
  { dx: 4.6, dy: 3.6, kind: "cross" },
  { dx: -5.4, dy: -3.4, kind: "cross" },
  { dx: 6.6, dy: -3.0, kind: "square" },
  { dx: -2.6, dy: -6.2, kind: "square" },
  { dx: 5.2, dy: -6.4, kind: "white" },
];

// Faint survey dots scattered over the terrain (world coords).
const SURVEY_DOTS = (() => {
  const r = rng(7);
  return Array.from({ length: 22 }, () => ({ x: (r() - 0.5) * 80, y: (r() - 0.5) * 50 }));
})();

export const WideHud: React.FC<{
  frame: number;
  cam: Camera;
  variant: SatelliteVariant;
  lensR: number;
  lensAlpha: number;
  palette: SatellitePalette;
}> = ({ frame, cam, lensR, lensAlpha, palette }) => {
  const out = 1 - ramp(frame, T.zoomStart + 4, T.zoomStart + 22);
  if (out <= 0) return null;
  const tgt = project(cam, WIDE_TARGET.x, WIDE_TARGET.y, W, H);
  const ping = ramp(frame, T.targetPing, T.targetPing + 8, easeOut);
  const cIcon = flickerIn(frame, T.iconC, 3);
  const rim = ramp(frame, T.amberRing, T.amberRing + 16, easeOut);
  const dashCircle = ramp(frame, T.iconC + 2, T.lensStart + 4, easeOut) * (1 - ramp(frame, T.lensFull, T.lensFull + 8));
  const markersIn = (i: number) => flickerIn(frame, T.lensFull + 6 + i * 3, i);
  const labelBar = ramp(frame, T.amberRing + 8, T.amberRing + 20, easeOut);
  const sweepLabel = Math.floor((frame - T.lensFull) / 3) % 2;

  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }} opacity={out}>
      {/* Static frame furniture */}
      <g opacity={0.8}>
        <rect x={0} y={330} width={14} height={240} fill="rgba(20,30,38,0.75)" />
        <rect x={0} y={600} width={10} height={90} fill="rgba(20,30,38,0.6)" />
        <rect x={430} y={0} width={110} height={5} fill={palette.amber} opacity={0.85} />
        <line x1={140} y1={1066} x2={1500} y2={1040} stroke={palette.amber} strokeWidth={1.2} opacity={0.5} />
        {[
          [70, 200],
          [190, 470],
          [1120, 210],
          [610, 165],
          [1500, 395],
          [1760, 560],
          [80, 600],
          [1640, 210],
        ].map(([x, y], i) => (
          <line key={i} x1={x} y1={y} x2={x + 26} y2={y} stroke={palette.cyan} strokeWidth={3} opacity={0.75} />
        ))}
      </g>
      {/* Survey dots locked to the terrain */}
      {SURVEY_DOTS.map((d, i) => {
        const p = project(cam, d.x, d.y, W, H);
        if (!p) return null;
        return <circle key={i} cx={p.x} cy={p.y} r={2.4} fill={palette.white} opacity={0.65} />;
      })}
      {/* Site label */}
      <g transform="translate(222 254)" opacity={0.85}>
        <text fontFamily={FONT_LABEL} fontSize={15} fill={palette.white} letterSpacing={1}>
          TE-61
        </text>
        <text y={14} fontFamily={FONT_MONO} fontSize={8} fill={palette.white} opacity={0.7}>
          SECTOR 61 / GRID 0412
        </text>
      </g>
      <LetterBadge x={160} y={220} letter="C" color={palette.white} opacity={cIcon} spin={frame * 1.5} />

      {tgt ? (
        <g>
          {/* Thin dashed range circle that precedes the lens */}
          <circle
            cx={tgt.x}
            cy={tgt.y}
            r={lensR * 1.22}
            fill="none"
            stroke={palette.white}
            strokeWidth={1}
            strokeDasharray="3 7"
            opacity={dashCircle * 0.7}
          />
          {/* Lens rim, outer tick dots and label */}
          <g opacity={lensAlpha}>
            <circle
              cx={tgt.x}
              cy={tgt.y}
              r={lensR}
              fill="none"
              stroke={palette.amber}
              strokeWidth={2.4}
              pathLength={1}
              strokeDasharray={`${rim} 1`}
              transform={`rotate(-90 ${tgt.x} ${tgt.y})`}
            />
            <circle
              cx={tgt.x}
              cy={tgt.y}
              r={lensR * 1.235}
              fill="none"
              stroke={palette.white}
              strokeWidth={2}
              strokeDasharray="1.2 9"
              strokeLinecap="round"
              opacity={0.8 * rim}
              transform={`rotate(${frame * -0.2} ${tgt.x} ${tgt.y})`}
            />
            {/* Inner dashed arc around the target */}
            <circle
              cx={tgt.x}
              cy={tgt.y}
              r={lensR * 0.3}
              fill="none"
              stroke={palette.white}
              strokeWidth={1.4}
              strokeDasharray="10 6"
              opacity={0.75 * rim}
              transform={`rotate(${frame * 0.6} ${tgt.x} ${tgt.y})`}
            />
            <g transform={`translate(${tgt.x + lensR * 0.62} ${tgt.y - lensR * 0.8})`} opacity={labelBar}>
              <rect x={0} y={0} width={110 * labelBar} height={10} fill={palette.amber} />
              <text x={4} y={-6} fontFamily={FONT_MONO} fontSize={9} fill={palette.amber}>
                {sweepLabel ? "SCAN 61-A  ACTIVE" : "SCAN 61-A  ....."}
              </text>
            </g>
            {/* Faint amber frame around the lens */}
            <rect
              x={tgt.x - lensR * 0.95}
              y={tgt.y - lensR * 0.95}
              width={lensR * 1.9}
              height={lensR * 1.9}
              fill="none"
              stroke={palette.amber}
              strokeWidth={1}
              opacity={0.35 * rim}
            />
            {/* "8" badge bottom right */}
            <g transform={`translate(${tgt.x + lensR * 1.05} ${tgt.y + lensR * 0.75})`} opacity={rim}>
              <circle r={13} fill="none" stroke={palette.white} strokeWidth={1.5} opacity={0.8} />
              <text y={5} textAnchor="middle" fontFamily={FONT_LABEL} fontSize={15} fill={palette.white}>
                8
              </text>
            </g>
            {LENS_MARKERS.map((m, i) => {
              const p = project(cam, WIDE_TARGET.x + m.dx, WIDE_TARGET.y + m.dy, W, H);
              if (!p || m.kind === "cross" || m.kind === "square") return null;
              return (
                <text key={`t${i}`} x={p.x + 12} y={p.y - 9} fontFamily={FONT_MONO} fontSize={9} fill={palette.white} opacity={markersIn(i) * 0.8}>
                  {`T-${String(i + 1).padStart(2, "0")}`}
                </text>
              );
            })}
            {LENS_MARKERS.map((m, i) => {
              const p = project(cam, WIDE_TARGET.x + m.dx, WIDE_TARGET.y + m.dy, W, H);
              if (!p) return null;
              const o = markersIn(i);
              switch (m.kind) {
                case "amber":
                  return (
                    <g key={i} opacity={o}>
                      <circle cx={p.x} cy={p.y} r={8} fill="none" stroke={palette.amber} strokeWidth={3} />
                      <circle cx={p.x} cy={p.y} r={3} fill={palette.white} />
                    </g>
                  );
                case "red":
                  return <DotMarker key={i} x={p.x} y={p.y} r={4} core={palette.red} opacity={o} />;
                case "redRing":
                  return (
                    <g key={i} opacity={o}>
                      <circle cx={p.x} cy={p.y} r={8} fill="none" stroke={palette.red} strokeWidth={2.5} />
                      <circle cx={p.x} cy={p.y} r={3.2} fill={palette.white} />
                    </g>
                  );
                case "white":
                  return <circle key={i} cx={p.x} cy={p.y} r={5} fill="none" stroke={palette.white} strokeWidth={2} opacity={o} />;
                case "cross":
                  return <CrossMarker key={i} x={p.x} y={p.y} r={6} color={palette.white} opacity={o * 0.85} />;
                default:
                  return (
                    <rect key={i} x={p.x - 5} y={p.y - 5} width={10} height={10} fill="none" stroke={palette.white} strokeWidth={1.4} opacity={o * 0.8} />
                  );
              }
            })}
          </g>
          {/* Primary target */}
          <g transform={`translate(${tgt.x} ${tgt.y}) scale(${0.4 + 0.6 * ping})`}>
            <DotMarker x={0} y={0} r={5} core={palette.red} opacity={ping} />
            <circle
              r={8 + 26 * ping}
              fill="none"
              stroke={palette.red}
              strokeWidth={2}
              opacity={ping > 0 ? (1 - ping) * 0.9 : 0}
            />
          </g>
        </g>
      ) : null}
    </svg>
  );
};
