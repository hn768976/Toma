import React from "react";
import { Easing, interpolate } from "remotion";
import type { Layout } from "../layout";
import type { Theme } from "../theme";
import type { Accent, Point } from "../topics";
import { FONT_STACK } from "../fonts";
import { buildCurvePath } from "../geometry";
import { buildMarkers } from "../markers";
import { linearProgress, reveal } from "../reveal";
import { TIMING } from "../timing";

/**
 * The main card: a hairline-bordered panel holding the S-curve and the cluster
 * markers. No axes, no gridlines, no numbers — shape only, as the reference
 * has it.
 */
export const ChartCard: React.FC<{
  label: string;
  data: Point[];
  theme: Theme;
  accent: Accent;
  layout: Layout;
  frame: number;
  seed: number;
  markerCount: number;
  idPrefix: string;
}> = ({
  label,
  data,
  theme,
  accent,
  layout,
  frame,
  seed,
  markerCount,
  idPrefix,
}) => {
  const { u, card, plot, cardLabel } = layout;

  const cardP = reveal(frame, TIMING.card.from, TIMING.card.to);
  // Steady and unaeased: the line should read as being plotted, not as an
  // animation easing to a stop.
  const drawP = linearProgress(
    frame,
    TIMING.chartDraw.from,
    TIMING.chartDraw.to,
  );

  const curve = buildCurvePath(data, {
    x: u(plot.x) - u(card.x),
    y: u(plot.y) - u(card.y),
    width: u(plot.width),
    height: u(plot.height),
  });

  const markers = buildMarkers(seed, markerCount, layout.marker);
  const stagger =
    markers.length > 1
      ? (TIMING.markers.to - TIMING.markers.from - TIMING.markerAppear) /
        (markers.length - 1)
      : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: u(card.x),
        top: u(card.y),
        width: u(card.width),
        height: u(card.height),
        background: theme.card,
        border: `${Math.max(1, u(2))}px solid ${theme.border}`,
        borderRadius: u(card.radius),
        boxShadow: theme.cardShadow,
        boxSizing: "border-box",
        opacity: cardP,
        transform: `translateY(${u((1 - cardP) * card.rise)}px)`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: u(cardLabel.x) - u(card.x),
          top: u(cardLabel.y) - u(card.y),
          color: theme.label,
          fontFamily: FONT_STACK,
          fontSize: u(cardLabel.fontSize),
          fontWeight: 500,
          letterSpacing: `${cardLabel.tracking}em`,
          lineHeight: 1,
        }}
      >
        {label}
      </div>

      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <radialGradient id={`${idPrefix}-halo`}>
            <stop offset="0%" stopColor={`rgba(${accent.halo},0.50)`} />
            <stop offset="34%" stopColor={`rgba(${accent.halo},0.40)`} />
            <stop offset="62%" stopColor={`rgba(${accent.halo},0.17)`} />
            <stop offset="100%" stopColor={`rgba(${accent.halo},0)`} />
          </radialGradient>
        </defs>

        {drawP > 0 ? (
          <path
            d={curve}
            fill="none"
            stroke={accent.line}
            strokeWidth={u(layout.curveWidth)}
            strokeLinecap="round"
            strokeLinejoin="round"
            // pathLength normalises the geometry to 1, so the dash reveal is a
            // plain 0..1 progress and never needs the DOM measured.
            pathLength={1}
            strokeDasharray={`${drawP} 1`}
          />
        ) : null}

        {markers.map((m, i) => {
          const start = TIMING.markers.from + i * stagger;
          const appear = interpolate(
            frame,
            [start, start + TIMING.markerAppear],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            },
          );
          if (appear <= 0) return null;

          // The halo expands past its resting size once as the marker lands,
          // then settles.
          const settle = interpolate(
            frame,
            [start, start + TIMING.markerAppear * 0.55, start + TIMING.markerAppear * 1.4],
            [0.55, 1.22, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.quad),
            },
          );
          // ...and breathes gently for the rest of the shot, each on its own
          // cycle so the field never pulses in unison.
          const pulse =
            1 +
            0.07 *
              Math.sin(
                2 * Math.PI * ((frame - start) / m.pulsePeriod + m.pulsePhase),
              );

          const cx = u(m.x) - u(card.x);
          const cy = u(m.y) - u(card.y);
          const r = u(m.radius);

          return (
            <g key={i} opacity={appear}>
              <circle
                cx={cx}
                cy={cy}
                r={r * settle * pulse}
                fill={`url(#${idPrefix}-halo)`}
              />
              <circle
                cx={cx}
                cy={cy}
                r={r * 0.42 * appear}
                fill="none"
                stroke={`rgba(${accent.halo},0.38)`}
                strokeWidth={u(2.5)}
              />
              <circle
                cx={cx}
                cy={cy}
                r={r * 0.15 * appear}
                fill={accent.marker}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
