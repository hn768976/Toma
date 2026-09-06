import React from "react";
import { AbsoluteFill } from "remotion";
import { DURATION_IN_FRAMES, SWEEP_CROSSINGS } from "../constants";
import type { Trace } from "../useTraces";
import type { Theme } from "../theme";

/**
 * The sweep is a second, brighter copy of the traces masked to a soft vertical
 * band and screen-blended over the first, so it lifts the traces it passes over
 * the way a scope's beam re-excites the phosphor.
 *
 * It deliberately paints nothing on the empty field. An earlier version also
 * laid a faint gradient bar across the whole frame height, which lifted the
 * background by ~12 levels and read as a light column shimmering across the
 * picture — far more conspicuous than the traces it was meant to accent.
 *
 * The band enters fully off the left edge and leaves fully off the right, which
 * is what keeps the wrap invisible. SWEEP_CROSSINGS crossings per loop.
 */
export const Sweep: React.FC<{
  traces: Trace[];
  theme: Theme;
  frame: number;
  scale: number;
  width: number;
  height: number;
}> = ({ traces, theme, frame, scale, width, height }) => {
  const band = width * 0.055;
  const progress = ((frame * SWEEP_CROSSINGS) / DURATION_IN_FRAMES) % 1;
  const x = -band + progress * (width + band * 2);
  const maskId = `sweep-mask-${theme.id}`;
  const gradId = `sweep-grad-${theme.id}`;

  return (
    <AbsoluteFill style={{ mixBlendMode: "screen" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1={x - band}
            y1={0}
            x2={x + band}
            y2={0}
          >
            <stop offset="0" stopColor="#000000" />
            <stop offset="0.5" stopColor="#ffffff" />
            <stop offset="1" stopColor="#000000" />
          </linearGradient>
          <mask id={maskId}>
            <rect
              x={x - band}
              y={0}
              width={band * 2}
              height={height}
              fill={`url(#${gradId})`}
            />
          </mask>
        </defs>

        <g mask={`url(#${maskId})`}>
          {traces.map((trace) => (
            <path
              key={trace.key}
              d={trace.d}
              fill="none"
              stroke={theme.traces[trace.key].color}
              strokeWidth={theme.traces[trace.key].width * 2.1 * scale}
              strokeOpacity={0.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: `blur(${6 * scale}px)` }}
            />
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
