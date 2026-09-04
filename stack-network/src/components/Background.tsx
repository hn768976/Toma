import React from "react";
import { AbsoluteFill } from "remotion";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../lib/constants";
import { driftOffset } from "../lib/loop";
import type { Theme } from "../lib/theme";
import { FONT_FAMILY } from "../load-fonts";

/**
 * The defocused field the network sits on: a flat base, a stack of soft
 * gradient washes, drifting bokeh shapes and one oversized ghost word.
 *
 * The bokeh are radial gradients rather than blurred discs on purpose --
 * a gradient with a soft outer stop *is* an out-of-focus highlight, and
 * it costs nothing to composite, where a dozen filter: blur(300px) layers
 * at UHD would dominate the frame time.
 */
export const Background: React.FC<{ theme: Theme; progress: number }> = ({
  theme,
  progress,
}) => (
  <AbsoluteFill style={{ backgroundColor: theme.base, overflow: "hidden" }}>
    {theme.washes.map((wash, i) => (
      <AbsoluteFill key={i} style={{ backgroundImage: wash }} />
    ))}

    {/* Bokeh live in board space so they drift with the same plane. */}
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: BOARD_WIDTH,
          height: BOARD_HEIGHT,
          marginLeft: -BOARD_WIDTH / 2,
          marginTop: -BOARD_HEIGHT / 2,
          // Slightly larger than the frame so drifting shapes never pop in.
          transform: "scale(0.82)",
        }}
      >
        {theme.bokeh.map((b, i) => {
          const drift = driftOffset(
            progress,
            b.driftCycles,
            b.driftPhase,
            b.driftRadius,
            b.driftRadius * 0.7,
          );
          // A softer shape holds its colour further out before falling off.
          const core = 26 + b.softness * 24;
          const edge = 62 + b.softness * 32;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: b.x - b.radius + drift.x,
                top: b.y - b.radius + drift.y,
                width: b.radius * 2,
                height: b.radius * 2,
                borderRadius: "50%",
                opacity: b.opacity,
                backgroundImage: `radial-gradient(circle at 50% 50%, ${b.color} 0%, ${b.color} ${core}%, rgba(0,0,0,0) ${edge}%)`,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>

    {/* Oversized blurred word, as in the references. */}
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${theme.ghost.x * 100}%`,
          top: `${theme.ghost.y * 100}%`,
          transform: `translate(-50%, -50%) rotate(${theme.ghost.rotate}deg) translateX(${
            driftOffset(progress, 1, 0.25, 34, 18).x
          }px)`,
          fontFamily: FONT_FAMILY,
          fontWeight: 700,
          fontSize: theme.ghost.size,
          letterSpacing: "0.06em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          color: theme.ghost.color,
          filter: `blur(${theme.ghost.blur}px)`,
        }}
      >
        {theme.ghost.text}
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
