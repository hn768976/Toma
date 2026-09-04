import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { BARS } from "../content";
import { useU } from "../layout";
import { MONO } from "../load-fonts";
import type { Theme } from "../theme";

/**
 * Short horizontal level bars. Each one drifts on its own period and
 * phase, so the block never pulses in unison.
 */
export const BarReadout: React.FC<{ theme: Theme; scale: number }> = ({
  theme,
  scale,
}) => {
  const frame = useCurrentFrame();
  const u = useU();

  const fs = u(scale);

  // Bars sit at their base value until frame 200, then start drifting.
  const live = interpolate(frame, [200, 240], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        padding: `${fs * 0.7}px ${fs * 0.8}px`,
        display: "flex",
        flexDirection: "column",
        gap: fs * 0.42,
        fontFamily: MONO,
        fontSize: fs,
        color: theme.body,
      }}
    >
      {BARS.map((bar) => {
        const drift =
          bar.amp * Math.sin((frame / bar.period) * Math.PI * 2 + bar.phase);
        const value = Math.max(0.04, Math.min(1, bar.base + drift * live));
        const hot = value > 0.82;
        return (
          <div
            key={bar.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: fs * 0.6,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: theme.bodyDim }}>{bar.label}</span>
            <div
              style={{
                flex: 1,
                height: fs * 0.78,
                background: "rgba(255,255,255,0.035)",
                border: `${Math.max(1, u(0.0006))}px solid ${theme.frame}`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${value * 100}%`,
                  background: hot ? theme.warn : theme.body,
                  opacity: hot ? 0.72 : 0.5,
                }}
              />
            </div>
            <span
              style={{
                width: fs * 2.4,
                textAlign: "right",
                color: hot ? theme.warn : theme.body,
              }}
            >
              {Math.round(value * 100)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
