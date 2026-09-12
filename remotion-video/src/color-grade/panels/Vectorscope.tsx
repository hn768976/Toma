import React, { useMemo } from "react";
import { UI } from "../constants";
import { fbm, hash } from "../noise";
import type { Grade } from "../grade";

type Props = {
  size: number;
  grade: Grade;
  frame: number;
  points?: number;
  title?: string;
};

// Broadcast target boxes, at their standard 75%-bar angles/positions.
const TARGETS: { label: string; deg: number }[] = [
  { label: "R", deg: 103.5 },
  { label: "MG", deg: 61 },
  { label: "B", deg: 192 },
  { label: "CY", deg: 283.5 },
  { label: "G", deg: 241 },
  { label: "YL", deg: 167 },
];

// Vectorscope: hue as angle, saturation as radius.
//
// The blob is derived from the same Grade the parade reads, so pushing a
// wheel toward blue swings this cloud toward the blue target too. The
// cloud is redrawn from a per-frame hash rather than animated, which
// gives the restless "boiling" quality of a live scope.
export const Vectorscope: React.FC<Props> = ({
  size,
  grade,
  frame,
  points = 900,
  title = "Vectorscope",
}) => {
  const r = size * 0.5;
  const cx = r;
  const cy = r;
  const graticuleR = r * 0.78;

  const cloud = useMemo(() => {
    // Where the overall colour balance sits, from the gain trim.
    const bias = {
      x: (grade.gain.b - (grade.gain.r + grade.gain.g) / 2) * 0.42,
      y: -(grade.gain.r - grade.gain.g) * 0.38,
    };
    const out: { x: number; y: number; o: number }[] = [];
    for (let i = 0; i < points; i++) {
      // Two lobes: a dense neutral core plus an arm along the skin-tone
      // line, which is what most real footage actually looks like.
      const lobe = hash(i, 7) < 0.62 ? 0 : 1;
      const ang =
        lobe === 0
          ? hash(i, 11) * Math.PI * 2
          : (-33 + (hash(i, 13) - 0.5) * 46) * (Math.PI / 180);
      const spread = lobe === 0 ? 0.3 : 0.52;
      const rad =
        Math.pow(hash(i, 17), 1.7) *
        spread *
        graticuleR *
        grade.saturation *
        (0.8 + 0.4 * fbm(i * 0.31 + frame * 0.05, 23, 2));
      const wobble = fbm(i * 0.7 + frame * 0.6, i % 13, 2) - 0.5;
      out.push({
        x: cx + Math.cos(ang) * rad + bias.x * graticuleR + wobble * 3,
        y: cy + Math.sin(ang) * rad + bias.y * graticuleR + wobble * 3,
        o: 0.18 + 0.7 * hash(i, frame % 97),
      });
    }
    return out;
  }, [cx, cy, frame, grade, graticuleR, points]);

  return (
    <div
      style={{
        width: size,
        height: size * 1.12,
        background: UI.panel,
        border: `1px solid ${UI.edgeLine}`,
        borderRadius: size * 0.02,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: size * 0.1,
          display: "flex",
          alignItems: "center",
          padding: `0 ${size * 0.035}px`,
          background: "linear-gradient(#1e2b39, #16202b)",
          fontSize: size * 0.052,
          color: UI.text,
          borderBottom: `1px solid ${UI.edgeLine}`,
        }}
      >
        {title}
        <span style={{ color: UI.textDim, marginLeft: size * 0.02 }}>⌄</span>
      </div>
      <svg width={size} height={size} style={{ display: "block", background: "#070b10" }}>
        {/* Hue ring */}
        <circle
          cx={cx}
          cy={cy}
          r={graticuleR}
          fill="none"
          stroke="rgba(140,180,210,0.2)"
          strokeWidth={1}
        />
        <circle
          cx={cx}
          cy={cy}
          r={graticuleR * 0.5}
          fill="none"
          stroke="rgba(140,180,210,0.12)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
        <line
          x1={cx - graticuleR}
          x2={cx + graticuleR}
          y1={cy}
          y2={cy}
          stroke="rgba(140,180,210,0.14)"
          strokeWidth={1}
        />
        <line
          x1={cx}
          x2={cx}
          y1={cy - graticuleR}
          y2={cy + graticuleR}
          stroke="rgba(140,180,210,0.14)"
          strokeWidth={1}
        />
        {/* Skin-tone line */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(-33 * (Math.PI / 180)) * graticuleR}
          y2={cy + Math.sin(-33 * (Math.PI / 180)) * graticuleR}
          stroke={UI.amber}
          strokeWidth={1}
          opacity={0.5}
          strokeDasharray="5 4"
        />
        {TARGETS.map((t) => {
          const a = t.deg * (Math.PI / 180);
          const tx = cx + Math.cos(a) * graticuleR * 0.86;
          const ty = cy + Math.sin(a) * graticuleR * 0.86;
          const b = size * 0.042;
          return (
            <g key={t.label}>
              <rect
                x={tx - b / 2}
                y={ty - b / 2}
                width={b}
                height={b}
                fill="none"
                stroke="rgba(170,205,230,0.5)"
                strokeWidth={1}
              />
              <text
                x={tx + b * 0.85}
                y={ty + b * 0.35}
                fontSize={size * 0.045}
                fill={UI.textDim}
              >
                {t.label}
              </text>
            </g>
          );
        })}
        <g style={{ mixBlendMode: "screen" }}>
          {cloud.map((p, i) => (
            <rect
              key={i}
              x={p.x}
              y={p.y}
              width={2.1}
              height={2.1}
              fill={i % 7 === 0 ? "#dff3e2" : "#46e07a"}
              opacity={p.o}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};
