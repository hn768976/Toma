import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ACCENT, alpha, DISPLAY_FONT, MONO_FONT, PIPE } from "../shared/theme";
import { wander } from "../shared/rand";
import { PIPE_LAYOUT, STAGES } from "./data";

const BAR_W = 150;

export const StageLoad: React.FC = () => {
  const frame = useCurrentFrame();
  const { stageLoadY, barY, barPctY, margin } = PIPE_LAYOUT;
  const appear = interpolate(frame, [44, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: margin,
          top: stageLoadY,
          fontFamily: DISPLAY_FONT,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 3,
          color: PIPE.textDim,
          opacity: appear,
        }}
      >
        STAGE LOAD
      </div>
      <div
        style={{
          position: "absolute",
          right: margin,
          top: stageLoadY,
          fontFamily: DISPLAY_FONT,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 3,
          color: PIPE.textDim,
          opacity: appear,
        }}
      >
        AUTO BALANCED
      </div>

      {STAGES.map((s, i) => {
        const grow = interpolate(frame, [48 + i * 4, 78 + i * 4], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: (t) => 1 - (1 - t) ** 3,
        });
        const value = wander(`load${i}`, frame / 46 + i, s.load - 16, s.load + 16, 2) * grow;

        return (
          <div key={s.id} style={{ opacity: appear }}>
            <div
              style={{
                position: "absolute",
                left: s.cx - BAR_W / 2,
                top: barY,
                width: BAR_W,
                height: 5,
                borderRadius: 3,
                background: PIPE.track,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, value))}%`,
                  height: "100%",
                  borderRadius: 3,
                  background: s.color,
                  boxShadow: `0 0 8px ${alpha(s.color, 0.8)}`,
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                left: s.cx - 60,
                top: barPctY,
                width: 120,
                textAlign: "center",
                fontFamily: MONO_FONT,
                fontSize: 10,
                color: PIPE.textDim,
              }}
            >
              {Math.round(value)}%
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: margin,
          right: margin,
          top: barPctY + 34,
          height: 1,
          background: alpha(ACCENT.blue, 0.08),
          opacity: appear,
        }}
      />
    </>
  );
};
