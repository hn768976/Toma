import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { BOARD_HEIGHT, BOARD_WIDTH, TRACE_GLOW_COLOR } from "./constants";
import { generateBoard, type Trace } from "./traces";
import type { Point } from "./geometry";

// The flat circuit board: dim blue traces with a soft glow, square pads,
// glowing node dots, and bright light "packets" sliding along the
// traces. Rendered as one SVG in board space; the parent tilts it into
// perspective.
const TracePaths: React.FC<{ traces: Trace[]; glow: boolean }> = ({ traces, glow }) => (
  <g
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    filter={glow ? "url(#traceGlow)" : undefined}
    opacity={glow ? 0.7 : 0.85}
  >
    {traces.map((t) => (
      <path
        key={t.id}
        d={t.d}
        stroke={glow ? TRACE_GLOW_COLOR : t.color}
        strokeWidth={glow ? t.width * 2.4 : t.width}
      />
    ))}
  </g>
);

const Pulses: React.FC<{ traces: Trace[]; frame: number; glow: boolean }> = ({ traces, frame, glow }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round" filter={glow ? "url(#pulseGlow)" : undefined}>
    {traces.map((t) =>
      t.pulses.map((p, i) => {
        const cycle = t.length + p.length * 2;
        let pos = (p.phase + frame * p.speed) % cycle;
        if (pos < 0) pos += cycle;
        // Dash starts at (pos - length): it enters from before the start
        // and leaves after the end so pulses don't pop in.
        const start = pos - p.length;
        return (
          <path
            key={`${t.id}-${i}`}
            d={t.d}
            pathLength={t.length}
            stroke={p.color}
            strokeWidth={glow ? p.width * 3 : p.width}
            strokeDasharray={`${p.length} ${t.length + p.length * 2}`}
            strokeDashoffset={-start}
            opacity={glow ? 0.85 : 1}
          />
        );
      }),
    )}
  </g>
);

export const CircuitBoard: React.FC<{ seed: number; hub: Point[] }> = ({ seed, hub }) => {
  const frame = useCurrentFrame();
  const board = useMemo(() => generateBoard(seed, hub), [seed, hub]);
  const { traces, vias } = board;

  return (
    <svg
      width={BOARD_WIDTH}
      height={BOARD_HEIGHT}
      viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <filter id="traceGlow" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="pulseGlow" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <radialGradient id="nodeGrad">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="currentColor" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="boardLight" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#08215a" stopOpacity="0.8" />
          <stop offset="55%" stopColor="#051538" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#020713" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Board surface: a faint blue sheen plus a fine grid. */}
      <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="url(#boardLight)" />
      <g stroke="#123a8a" strokeWidth={1} opacity={0.1}>
        {Array.from({ length: Math.floor(BOARD_WIDTH / 120) + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * 120} y1={0} x2={i * 120} y2={BOARD_HEIGHT} />
        ))}
        {Array.from({ length: Math.floor(BOARD_HEIGHT / 120) + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 120} x2={BOARD_WIDTH} y2={i * 120} />
        ))}
      </g>
      <g fill="#1d4fb0" opacity={0.5}>
        {vias.map((v, i) => (
          <circle key={i} cx={v.x} cy={v.y} r={3} />
        ))}
      </g>

      <TracePaths traces={traces} glow />
      <TracePaths traces={traces} glow={false} />

      {/* Square pads at trace ends. */}
      <g fill="#061230" stroke="#3f8dff" strokeWidth={2.5}>
        {traces.map((t) =>
          t.pad ? <rect key={t.id} x={t.pad.x - 11} y={t.pad.y - 11} width={22} height={22} /> : null,
        )}
      </g>
      <g fill="#3f8dff">
        {traces.map((t) =>
          t.pad ? <rect key={t.id} x={t.pad.x - 4} y={t.pad.y - 4} width={8} height={8} /> : null,
        )}
      </g>

      <Pulses traces={traces} frame={frame} glow />
      <Pulses traces={traces} frame={frame} glow={false} />

      {/* Glowing node dots, gently breathing. */}
      <g>
        {traces.map((t) =>
          t.nodes.map((n, i) => {
            const breathe = 0.7 + 0.3 * Math.sin(frame * 0.08 + n.phase);
            return (
              <g key={`${t.id}-${i}`} style={{ color: n.color }}>
                <circle cx={n.p.x} cy={n.p.y} r={n.r * 3.2} fill="url(#nodeGrad)" opacity={0.55 * breathe} />
                <circle cx={n.p.x} cy={n.p.y} r={n.r} fill="url(#nodeGrad)" opacity={breathe} />
              </g>
            );
          }),
        )}
      </g>
    </svg>
  );
};
