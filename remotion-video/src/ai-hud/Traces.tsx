import React from "react";
import { useCurrentFrame } from "remotion";
import { PALETTE } from "./constants";
import { TRACES } from "./geometry";
import { dashPhase } from "./loop";

// ---------------------------------------------------------------------------
// Circuit traces.
//
// Pulses are stroke-dasharray scrolls: one short dash and a gap equal to the
// rest of the run, with the offset stepped by
//
//     -(patternLength * N * frame / durationInFrames)
//
// N integer, so at the last frame the offset is an exact multiple of the
// pattern and the pulse is back where it started. Different runs get
// different N (1..4) so the network visibly flows at several speeds.
//
// dashPhase() applies that formula reduced modulo the pattern length, which
// is visually identical but avoids the sub-pixel rounding that a five-figure
// dash offset introduces at the wrap point.
//
// The whole group takes the TIGHT glow filter. The core is the only thing
// allowed the wide one — if the traces get it too, the network turns into a
// blue smear instead of reading as lit wire.
// ---------------------------------------------------------------------------

export const Traces: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <g filter="url(#glowTrace)">
      {/* Unlit wire. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {TRACES.map((t, i) => (
          <path
            key={`b${i}`}
            d={t.d}
            stroke={PALETTE.cyan}
            strokeWidth={t.width}
            opacity={t.opacity * 0.5}
          />
        ))}
        {TRACES.map((t, i) =>
          t.stub ? (
            <path
              key={`s${i}`}
              d={t.stub}
              stroke={PALETTE.cyan}
              strokeWidth={t.width * 0.9}
              opacity={t.opacity * 0.5}
            />
          ) : null,
        )}
      </g>

      {/* Travelling pulses. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {TRACES.map((t, i) => {
          const pulseLen = Math.max(46, t.length * 0.16);
          const offset = dashPhase(frame, t.length, t.pulseCycles, t.pulseShift);
          return (
            <path
              key={`p${i}`}
              d={t.d}
              stroke="#A6E9FE"
              strokeWidth={t.width * 1.05}
              strokeDasharray={`${pulseLen.toFixed(2)} ${(t.length - pulseLen).toFixed(2)}`}
              strokeDashoffset={offset.toFixed(3)}
              opacity={0.72}
            />
          );
        })}
      </g>

      {/* Junction dots along the runs, and the terminal node pads. */}
      <g>
        {TRACES.map((t, i) => (
          <React.Fragment key={`n${i}`}>
            {t.joints.map((j, k) => (
              <circle
                key={k}
                cx={j.x}
                cy={j.y}
                r={j.r}
                fill={PALETTE.cyan}
                opacity={t.opacity * 0.7}
              />
            ))}
            <circle
              cx={t.node.x}
              cy={t.node.y}
              r={t.node.r}
              fill={PALETTE.cyan}
              opacity={0.9}
            />
            <circle
              cx={t.node.x}
              cy={t.node.y}
              r={t.node.r * 0.45}
              fill="#BFF1FF"
              opacity={0.9}
            />
          </React.Fragment>
        ))}
      </g>
    </g>
  );
};
