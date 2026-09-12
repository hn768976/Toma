import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ACCENT, alpha, MONO_FONT } from "../shared/theme";
import { Bar, MicroLabel, Panel, Readout } from "../shared/ui";
import { smoothPath, type Pt } from "../shared/paths";
import { wander } from "../shared/rand";
import { LAYOUT } from "./data";

const CHART = { left: 46, top: 54, width: 566, height: 214 };
const SAMPLES = 46;
/** How far the trace travels per frame, in sample units. */
const SCROLL = 0.055;

const AXIS = ["45ms", "38ms", "31ms", "24ms", "17ms", "10ms"];

const METERS = [
  { label: "GPU UTIL", color: ACCENT.cyan, base: 64 },
  { label: "MEMORY", color: ACCENT.purple, base: 67 },
  { label: "NETWORK", color: ACCENT.emerald, base: 56 },
];

/** Sample one scrolling trace across the chart width. */
const trace = (seed: string, frame: number, amp: number, mid: number): Pt[] =>
  Array.from({ length: SAMPLES }, (_, i) => {
    const t = (i - frame * SCROLL) / 5.2;
    return {
      x: (i / (SAMPLES - 1)) * CHART.width,
      y: mid + wander(seed, t, -amp, amp, 3),
    };
  });

export const PerformanceEnvelope: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, w, h } = LAYOUT.envelope;
  const reveal = interpolate(frame, [26, 64], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const volume = trace("volume", frame, CHART.height * 0.3, CHART.height * 0.5);
  const pressure = trace("pressure", frame, CHART.height * 0.24, CHART.height * 0.44);
  const volumeD = smoothPath(volume);
  const headroom = wander("headroom", frame / 85, 15.4, 21.8, 2);

  return (
    <Panel
      x={x}
      y={y}
      width={w}
      height={h}
      title="PERFORMANCE ENVELOPE"
      accent={ACCENT.violet}
      delay={26}
    >
      {AXIS.map((label, i) => (
        <div
          key={label}
          style={{
            position: "absolute",
            left: 18,
            top: CHART.top + (i / (AXIS.length - 1)) * (CHART.height - 10),
            fontFamily: MONO_FONT,
            fontSize: 7.5,
            color: alpha(ACCENT.teal, 0.45),
            opacity: reveal,
          }}
        >
          {label}
        </div>
      ))}

      <svg
        width={CHART.width}
        height={CHART.height}
        style={{ position: "absolute", left: CHART.left, top: CHART.top }}
      >
        <defs>
          <linearGradient id="envelope-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={alpha(ACCENT.teal, 0.26)} />
            <stop offset="100%" stopColor={alpha(ACCENT.teal, 0)} />
          </linearGradient>
          <clipPath id="envelope-clip">
            <rect x={0} y={0} width={CHART.width * reveal} height={CHART.height} />
          </clipPath>
        </defs>
        <g clipPath="url(#envelope-clip)">
          <path
            d={`${volumeD} L ${CHART.width} ${CHART.height} L 0 ${CHART.height} Z`}
            fill="url(#envelope-fill)"
          />
          <path
            d={smoothPath(pressure)}
            fill="none"
            stroke={ACCENT.purple}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.85}
          />
          <path
            d={volumeD}
            fill="none"
            stroke={ACCENT.teal}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </g>
      </svg>

      {METERS.map((m, i) => {
        const value = wander(`meter${i}`, frame / 58 + i, m.base - 8, m.base + 8, 2);
        const colW = (w - 36 - 24) / 3;
        return (
          <div
            key={m.label}
            style={{
              position: "absolute",
              left: 18 + i * (colW + 12),
              top: 296,
              width: colW,
              opacity: reveal,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <MicroLabel style={{ fontSize: 7.5 }}>{m.label}</MicroLabel>
              <Readout size={9.5} color={m.color} weight={700}>
                {Math.round(value)}%
              </Readout>
            </div>
            <div style={{ marginTop: 7 }}>
              <Bar width={colW} value={value} color={m.color} height={3.4} />
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          bottom: 15,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: reveal,
        }}
      >
        <div style={{ display: "flex", gap: 18 }}>
          {[
            { c: ACCENT.teal, t: "Request volume" },
            { c: ACCENT.purple, t: "Compute pressure" },
          ].map((l) => (
            <div key={l.t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 11, height: 2, background: l.c, borderRadius: 1 }} />
              <MicroLabel style={{ fontSize: 7.5 }}>{l.t}</MicroLabel>
            </div>
          ))}
        </div>
        <MicroLabel style={{ fontSize: 7.5, color: alpha(ACCENT.teal, 0.75) }}>
          Predictive headroom {headroom.toFixed(1)}%
        </MicroLabel>
      </div>
    </Panel>
  );
};
