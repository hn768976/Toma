import React from "react";
import { AbsoluteFill } from "remotion";
import type { Trace } from "../useTraces";
import type { Theme } from "../theme";

const joinFor = (key: Trace["key"]) =>
  key === "square" ? ("miter" as const) : ("round" as const);

const Paths: React.FC<{
  traces: Trace[];
  theme: Theme;
  scale: number;
  widthOf: (key: Trace["key"]) => number;
  opacityOf: (key: Trace["key"]) => number;
  colorOf?: (key: Trace["key"]) => string;
}> = ({ traces, theme, scale, widthOf, opacityOf, colorOf }) => (
  <>
    {traces.map((trace) => (
      <path
        key={trace.key}
        d={trace.d}
        fill="none"
        stroke={colorOf ? colorOf(trace.key) : theme.traces[trace.key].color}
        strokeWidth={widthOf(trace.key) * scale}
        strokeOpacity={opacityOf(trace.key)}
        strokeLinecap="round"
        strokeLinejoin={joinFor(trace.key)}
      />
    ))}
  </>
);

/**
 * Three passes per trace, cheapest first: a wide outer halo, a tighter inner
 * bloom, and the crisp core on top. The two bloom passes share one blur each
 * rather than being blurred per-path, and the grid deliberately sits outside
 * this stack so it stays sharp while the traces glow.
 */
export const Traces: React.FC<{
  traces: Trace[];
  theme: Theme;
  scale: number;
  width: number;
  height: number;
}> = ({ traces, theme, scale, width, height }) => {
  const svg = {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
  };

  return (
    <>
      <AbsoluteFill
        style={{
          mixBlendMode: "screen",
          filter: `blur(${theme.bloom * 2.6 * scale}px)`,
          opacity: 0.55,
        }}
      >
        <svg {...svg}>
          <Paths
            traces={traces}
            theme={theme}
            scale={scale}
            widthOf={(k) => theme.traces[k].glowWidth * 1.7}
            opacityOf={(k) => theme.traces[k].glowOpacity}
          />
        </svg>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          mixBlendMode: "screen",
          filter: `blur(${theme.bloom * scale}px)`,
        }}
      >
        <svg {...svg}>
          <Paths
            traces={traces}
            theme={theme}
            scale={scale}
            widthOf={(k) => theme.traces[k].glowWidth}
            opacityOf={(k) => theme.traces[k].glowOpacity}
          />
        </svg>
      </AbsoluteFill>

      <AbsoluteFill>
        <svg {...svg}>
          <Paths
            traces={traces}
            theme={theme}
            scale={scale}
            widthOf={(k) => theme.traces[k].width}
            opacityOf={(k) => theme.traces[k].opacity}
          />
        </svg>
      </AbsoluteFill>
    </>
  );
};
