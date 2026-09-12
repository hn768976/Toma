import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ACCENT, alpha, DISPLAY_FONT, MONO_FONT, PIPE } from "../shared/theme";
import { pad2 } from "../shared/ui";
import { PIPE_LAYOUT } from "./data";

/** The scrubber maps directly onto the film's own runtime. */
export const TimelineBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { margin, timelineLabelY, timelineY, tickY } = PIPE_LAYOUT;
  const width = 1920 - margin * 2;
  const total = durationInFrames / fps;
  const elapsed = Math.min(total, frame / fps);
  const progress = elapsed / total;
  const appear = interpolate(frame, [56, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ticks = 6;

  return (
    <div style={{ opacity: appear }}>
      <div
        style={{
          position: "absolute",
          left: margin,
          top: timelineLabelY,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            background: ACCENT.teal,
            boxShadow: `0 0 9px ${ACCENT.teal}`,
            opacity: 0.6 + 0.4 * Math.sin((frame / 30) * Math.PI * 1.6),
          }}
        />
        <span
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 11.5,
            fontWeight: 500,
            letterSpacing: 2.6,
            color: PIPE.textDim,
          }}
        >
          PIPELINE ACTIVE
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          right: margin,
          top: timelineLabelY,
          fontFamily: MONO_FONT,
          fontSize: 11,
          color: PIPE.textDim,
          letterSpacing: 0.4,
        }}
      >
        T+{elapsed.toFixed(1).padStart(4, "0")}s / {total.toFixed(1)}s
      </div>

      <div
        style={{
          position: "absolute",
          left: margin,
          top: timelineY,
          width,
          height: 2,
          background: alpha("#8aa4cc", 0.18),
        }}
      >
        <div
          style={{
            width: width * progress,
            height: "100%",
            background: ACCENT.cyan,
            boxShadow: `0 0 10px ${alpha(ACCENT.cyan, 0.9)}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: width * progress - 1,
            top: -5,
            width: 2,
            height: 12,
            background: "#ffffff",
            boxShadow: `0 0 10px ${alpha("#ffffff", 0.8)}`,
          }}
        />
      </div>

      {Array.from({ length: ticks }, (_, i) => {
        const seconds = (total / (ticks - 1)) * i;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: margin + (width / (ticks - 1)) * i - 40,
              top: tickY,
              width: 80,
              textAlign: "center",
              fontFamily: MONO_FONT,
              fontSize: 8.5,
              color: PIPE.textFaint,
            }}
          >
            {pad2(seconds / 60)}:{pad2(seconds % 60)}
          </div>
        );
      })}
    </div>
  );
};
