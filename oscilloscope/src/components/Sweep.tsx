import React from "react";
import { AbsoluteFill } from "remotion";
import { rgba } from "../color";
import { DURATION_IN_FRAMES, SWEEP_CROSSINGS } from "../constants";
import type { Trace } from "../useTraces";
import type { Theme } from "../theme";

/**
 * The sweep is a second, brighter copy of the traces masked to a soft vertical
 * band, screen-blended over the first — so it genuinely lifts whatever it
 * crosses instead of laying a grey bar over the picture.
 *
 * It enters fully off the left edge and leaves fully off the right, which is
 * what keeps the wrap invisible. SWEEP_CROSSINGS crossings per loop.
 */
export const Sweep: React.FC<{
  traces: Trace[];
  theme: Theme;
  frame: number;
  scale: number;
  width: number;
  height: number;
}> = ({ traces, theme, frame, scale, width, height }) => {
  const band = width * 0.075;
  const progress =
    ((frame * SWEEP_CROSSINGS) / DURATION_IN_FRAMES) % 1;
  const x = -band + progress * (width + band * 2);
  const maskId = `sweep-mask-${theme.id}`;
  const gradId = `sweep-grad-${theme.id}`;
  const barId = `sweep-bar-${theme.id}`;

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
          <linearGradient
            id={barId}
            gradientUnits="userSpaceOnUse"
            x1={x - band}
            y1={0}
            x2={x + band}
            y2={0}
          >
            <stop offset="0" stopColor={rgba(theme.sweepColor, 0)} />
            <stop offset="0.5" stopColor={rgba(theme.sweepColor, 0.11)} />
            <stop offset="1" stopColor={rgba(theme.sweepColor, 0)} />
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

        {/* A faint bar so the sweep is legible over empty grid too. */}
        <rect
          x={x - band}
          y={0}
          width={band * 2}
          height={height}
          fill={`url(#${barId})`}
        />

        <g mask={`url(#${maskId})`}>
          {traces.map((trace) => (
            <path
              key={trace.key}
              d={trace.d}
              fill="none"
              stroke={theme.traces[trace.key].color}
              strokeWidth={theme.traces[trace.key].width * 2.1 * scale}
              strokeOpacity={0.55}
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
