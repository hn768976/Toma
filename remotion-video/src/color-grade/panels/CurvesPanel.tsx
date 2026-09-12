import React from "react";
import { UI } from "../constants";
import { clamp } from "../noise";
import type { Grade } from "../grade";

type Props = {
  width: number;
  height: number;
  grade: Grade;
  /** 0..1 drag handle on the highlight control point. */
  highlightPull?: number;
  title?: string;
};

const CHIPS: { label: string; color: string }[] = [
  { label: "Y", color: "#e8eef4" },
  { label: "R", color: UI.chanR },
  { label: "G", color: UI.chanG },
  { label: "B", color: UI.chanB },
];

// Custom-curve editor. The master curve is bent by the grade's average
// gamma so it agrees with whatever the wheels are doing, and the
// highlight control point is draggable by the scripted pointer.
export const CurvesPanel: React.FC<Props> = ({
  width,
  height,
  grade,
  highlightPull = 0,
  title = "Curves",
}) => {
  const headerH = height * 0.11;
  const pad = width * 0.045;
  const plotX = pad;
  const plotY = headerH + pad * 0.7;
  const plotW = width - pad * 2;
  const plotH = height - plotY - pad;

  const gamma = (grade.gamma.r + grade.gamma.g + grade.gamma.b) / 3;
  const sample = (t: number) => {
    const base = Math.pow(t, 1 / gamma);
    // Gentle film S on top of the gamma bend.
    const s = base + Math.sin(t * Math.PI) * 0.055 - Math.sin(t * Math.PI * 2) * 0.075;
    return clamp(s + highlightPull * 0.22 * Math.pow(t, 2.2), 0, 1);
  };

  const pts = Array.from({ length: 48 }, (_, i) => {
    const t = i / 47;
    return `${(plotX + t * plotW).toFixed(1)},${(
      plotY +
      plotH -
      sample(t) * plotH
    ).toFixed(1)}`;
  }).join(" ");

  const handles = [0.0, 0.32, 0.66, 1.0];

  return (
    <div
      style={{
        width,
        height,
        background: UI.panel,
        border: `1px solid ${UI.edgeLine}`,
        borderRadius: height * 0.02,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: headerH,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${width * 0.03}px`,
          background: "linear-gradient(#1e2b39, #16202b)",
          borderBottom: `1px solid ${UI.edgeLine}`,
        }}
      >
        <span style={{ fontSize: headerH * 0.48, color: UI.text }}>{title}</span>
        <span style={{ display: "flex", gap: headerH * 0.22 }}>
          {CHIPS.map((c, i) => (
            <span
              key={c.label}
              style={{
                width: headerH * 0.52,
                height: headerH * 0.52,
                borderRadius: 3,
                display: "grid",
                placeItems: "center",
                fontSize: headerH * 0.32,
                color: i === 0 ? "#0b1118" : c.color,
                background: i === 0 ? c.color : "rgba(255,255,255,0.06)",
                border: `1px solid ${UI.edgeLine}`,
              }}
            >
              {c.label}
            </span>
          ))}
        </span>
      </div>
      <svg width={width} height={height - headerH} viewBox={`0 ${headerH} ${width} ${height - headerH}`}>
        <rect x={plotX} y={plotY} width={plotW} height={plotH} fill="#080d13" />
        {Array.from({ length: 5 }, (_, i) => i).map((i) => (
          <g key={i}>
            <line
              x1={plotX + (i / 4) * plotW}
              x2={plotX + (i / 4) * plotW}
              y1={plotY}
              y2={plotY + plotH}
              stroke="rgba(150,185,215,0.2)"
            />
            <line
              x1={plotX}
              x2={plotX + plotW}
              y1={plotY + (i / 4) * plotH}
              y2={plotY + (i / 4) * plotH}
              stroke="rgba(150,185,215,0.2)"
            />
          </g>
        ))}
        <line
          x1={plotX}
          y1={plotY + plotH}
          x2={plotX + plotW}
          y2={plotY}
          stroke="rgba(150,185,215,0.2)"
          strokeDasharray="4 5"
        />
        <polyline points={pts} fill="none" stroke="#eaf2f8" strokeWidth={height * 0.012} opacity={0.22} />
        <polyline points={pts} fill="none" stroke="#f4f9fd" strokeWidth={1.8} />
        {handles.map((t) => (
          <rect
            key={t}
            x={plotX + t * plotW - width * 0.011}
            y={plotY + plotH - sample(t) * plotH - width * 0.011}
            width={width * 0.022}
            height={width * 0.022}
            fill={t === 1 && highlightPull > 0.02 ? UI.selection : "#dce8f2"}
            stroke="#0a1017"
          />
        ))}
      </svg>
    </div>
  );
};
