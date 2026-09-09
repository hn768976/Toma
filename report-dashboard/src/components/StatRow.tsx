import React from "react";
import { Easing, interpolate } from "remotion";
import type { Layout } from "../layout";
import type { Theme } from "../theme";
import type { Accent, Stat } from "../topics";
import { FONT_STACK, TABULAR } from "../fonts";
import { formatValue, isNegativeDelta } from "../format";
import { reveal } from "../reveal";
import { TIMING } from "../timing";

/**
 * Four KPI boxes. Each fades in on its own offset and counts its value up to
 * the target on an ease-out; the count is a pure function of the frame, so
 * there is no timer and no state to get out of step across render threads.
 */
export const StatRow: React.FC<{
  stats: Stat[];
  theme: Theme;
  accent: Accent;
  layout: Layout;
  frame: number;
}> = ({ stats, theme, accent, layout, frame }) => {
  const { u, card, stats: s } = layout;

  return (
    <>
      {stats.map((stat, i) => {
        const start = TIMING.stats.from + i * TIMING.statStagger;
        const p = reveal(frame, start, start + 40);
        if (p <= 0) return null;

        const countP = interpolate(
          frame,
          [start, start + TIMING.countDuration],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          },
        );
        const shown = formatValue(stat, stat.value * countP);
        const deltaColour = isNegativeDelta(stat.delta)
          ? accent.negative
          : accent.positive;

        return (
          <div
            key={stat.label}
            style={{
              position: "absolute",
              left: u(card.x + i * (s.width + s.gap)),
              top: u(s.y),
              width: u(s.width),
              height: u(s.height),
              background: theme.card,
              border: `${Math.max(1, u(2))}px solid ${theme.border}`,
              borderRadius: u(s.radius),
              boxShadow: theme.statShadow,
              boxSizing: "border-box",
              opacity: p,
              transform: `translateY(${u((1 - p) * s.rise)}px)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: u(s.padX),
                top: u(s.labelTop),
                color: theme.label,
                fontFamily: FONT_STACK,
                fontSize: u(s.labelSize),
                fontWeight: 500,
                letterSpacing: `${s.labelTracking}em`,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {stat.label}
            </div>

            <div
              style={{
                position: "absolute",
                left: u(s.padX),
                top: u(s.valueTop),
                display: "flex",
                alignItems: "baseline",
                gap: u(18),
              }}
            >
              {/* Tabular figures stop the digits themselves shuffling, but a
                  value gaining a digit mid-count (9,999 -> 10,000) would still
                  shove the delta sideways. Reserving the final string's width
                  and overlaying the live value pins everything in place. */}
              <span
                style={{
                  position: "relative",
                  display: "inline-block",
                  color: theme.title,
                  fontFamily: FONT_STACK,
                  fontSize: u(s.valueSize),
                  fontWeight: 400,
                  letterSpacing: "-0.01em",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  ...TABULAR,
                }}
              >
                <span style={{ visibility: "hidden" }}>
                  {formatValue(stat, stat.value)}
                </span>
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {shown}
                </span>
              </span>
              <span
                style={{
                  color: deltaColour,
                  fontFamily: FONT_STACK,
                  fontSize: u(s.deltaSize),
                  fontWeight: 500,
                  lineHeight: 1,
                  ...TABULAR,
                }}
              >
                {stat.delta}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
};
