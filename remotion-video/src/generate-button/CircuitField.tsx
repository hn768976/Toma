import React, { useCallback, useMemo } from "react";
import { interpolate } from "remotion";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  CENTER_X,
  CENTER_Y,
  TRACE_FADE_IN_END,
  TRACE_FADE_IN_START,
  WAVE_FADE_OUT_END,
  WAVE_FADE_OUT_START,
  WAVE_SPEED,
  WAVE_START_FRAME,
  WAVE_WIDTH,
} from "./constants";
import { getTraceField, type Trace } from "./traceField";
import type { Theme } from "./theme";

const VIEW_BOX = `0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`;

const svgBase: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  overflow: "visible",
};

const tierColor = (theme: Theme, tier: 0 | 1 | 2) =>
  tier === 0 ? theme.traceDim : tier === 1 ? theme.traceMid : theme.traceBright;

const tierOpacity = (theme: Theme, tier: 0 | 1 | 2) =>
  tier === 0
    ? theme.traceDimOpacity
    : tier === 1
      ? theme.traceMidOpacity
      : theme.traceBrightOpacity;

const TWO_PI = Math.PI * 2;

/** The trace's own slow brightness breath at this frame. */
const flickerAt = (trace: Trace, frame: number) => {
  const { period, phase, amp } = trace.flicker;
  return 1 + amp * Math.sin(TWO_PI * (frame / period + phase));
};

/**
 * Where each travelling pulse currently sits on its trace, as an SVG
 * dash offset. A single short dash is chased along an otherwise empty
 * dash pattern, which is far cheaper than animating real geometry.
 */
const pulseDashOffset = (trace: Trace, frame: number) => {
  const { period, phase, dash } = trace.pulse!;
  const p = ((frame / period + phase) % 1 + 1) % 1;
  return dash - p * (trace.length + dash);
};

/** One flat pass of strokes. Memoised: the geometry never changes. */
const Strokes: React.FC<{
  traces: Trace[];
  color: (t: Trace) => string;
  width: (t: Trace) => number;
  opacity?: (t: Trace) => number;
}> = React.memo(({ traces, color, width, opacity }) => (
  <>
    {traces.map((t, i) => (
      <path
        key={i}
        d={t.d}
        stroke={color(t)}
        strokeWidth={width(t)}
        strokeOpacity={opacity ? opacity(t) : 1}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ))}
  </>
));
Strokes.displayName = "Strokes";

export const CircuitField: React.FC<{
  frame: number;
  theme: Theme;
  /** Composition width / 1920 — CSS blur has to be in real pixels. */
  designScale: number;
}> = ({ frame, theme, designScale }) => {
  const { traces, pads } = getTraceField();

  const lit = useMemo(() => traces.filter((t) => t.tier > 0), [traces]);
  const pulsing = useMemo(() => traces.filter((t) => t.pulse), [traces]);

  const baseColor = useCallback((t: Trace) => tierColor(theme, t.tier), [theme]);
  const bloomWidth = useCallback((t: Trace) => t.strokeWidth * 1.4, []);
  const haloWidth = useCallback((t: Trace) => t.strokeWidth * 3.4, []);

  const reveal = interpolate(
    frame,
    [TRACE_FADE_IN_START, TRACE_FADE_IN_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // The brightness wave that sweeps outward once the button is pressed.
  const waveR = Math.max(0, (frame - WAVE_START_FRAME) * WAVE_SPEED);
  const waveOuter = waveR + WAVE_WIDTH;
  const waveInner = Math.max(0, waveR - WAVE_WIDTH);
  const waveAmp =
    interpolate(frame, [WAVE_START_FRAME - 4, WAVE_START_FRAME + 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(frame, [WAVE_FADE_OUT_START, WAVE_FADE_OUT_END], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  if (reveal <= 0) return null;

  const baseWidth = (t: Trace) => t.strokeWidth;
  // Only the base pass depends on the frame, so the halo and bloom layers
  // keep stable props and stay memoised across the whole render.
  const baseOpacity = (t: Trace) =>
    Math.min(1, tierOpacity(theme, t.tier) * flickerAt(t, frame));

  return (
    <>
      {/* Blurred bloom. Only the lit traces feed it, so the blur runs over a
          fraction of the geometry — important at 3840x2160. */}
      <svg
        viewBox={VIEW_BOX}
        style={{
          ...svgBase,
          filter: `blur(${(7 * designScale).toFixed(2)}px)`,
          mixBlendMode: theme.glowBlend,
          opacity: theme.bloomOpacity * reveal,
        }}
      >
        <Strokes
          traces={lit}
          color={baseColor}
          width={bloomWidth}
        />
      </svg>

      <svg viewBox={VIEW_BOX} style={{ ...svgBase, opacity: reveal }}>
        <defs>
          <radialGradient
            id="gb-wave"
            gradientUnits="userSpaceOnUse"
            cx={CENTER_X}
            cy={CENTER_Y}
            r={waveOuter}
          >
            <stop offset="0" stopColor="#000" />
            <stop offset={(waveInner / waveOuter).toFixed(4)} stopColor="#000" />
            <stop offset={(waveR / waveOuter).toFixed(4)} stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <mask id="gb-wave-mask" maskUnits="userSpaceOnUse" x="0" y="0"
            width={BASE_WIDTH} height={BASE_HEIGHT}>
            <rect
              x={0}
              y={0}
              width={BASE_WIDTH}
              height={BASE_HEIGHT}
              fill="url(#gb-wave)"
            />
          </mask>
        </defs>

        {/* Soft halo under the lit traces — a wide, faint stroke reads as a
            glow without paying for a second filter pass. */}
        <g opacity={theme.haloOpacity} style={{ mixBlendMode: theme.glowBlend }}>
          <Strokes
            traces={lit}
            color={baseColor}
            width={haloWidth}
          />
        </g>

        <Strokes
          traces={traces}
          color={baseColor}
          width={baseWidth}
          opacity={baseOpacity}
        />

        {pads.map((p, i) => (
          <rect
            key={i}
            x={p.x - p.size / 2}
            y={p.y - p.size / 2}
            width={p.size}
            height={p.size}
            fill={p.bright ? theme.traceBright : theme.padColor}
            opacity={p.bright ? 0.95 : 0.6}
          />
        ))}

        {/* Light pulses running outward along the routing. */}
        <g style={{ mixBlendMode: theme.glowBlend }}>
          {pulsing.map((t, i) => (
            <path
              key={i}
              d={t.d}
              stroke={theme.tracePulse}
              strokeWidth={t.strokeWidth * 1.25}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${t.pulse!.dash} ${t.length + t.pulse!.dash}`}
              strokeDashoffset={pulseDashOffset(t, frame)}
              opacity={0.7}
            />
          ))}
        </g>

        {/* The expanding brightness wave, masked to a travelling annulus. */}
        {waveAmp > 0.001 ? (
          <g
            mask="url(#gb-wave-mask)"
            opacity={waveAmp}
            style={{ mixBlendMode: theme.glowBlend }}
          >
            <Strokes
              traces={traces}
              color={() => theme.tracePulse}
              width={(t) => t.strokeWidth * 1.15}
              opacity={(t) => (t.tier === 0 ? 0.2 : 0.4)}
            />
          </g>
        ) : null}
      </svg>
    </>
  );
};
