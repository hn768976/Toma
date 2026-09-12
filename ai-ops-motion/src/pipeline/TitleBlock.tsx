import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ACCENT, alpha, DISPLAY_FONT, PIPE } from "../shared/theme";
import { PIPE_LAYOUT } from "./data";

export const TitleBlock: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, w, h } = PIPE_LAYOUT.titleFrame;

  const frameDraw = interpolate(frame, [0, 26], [0, 1], {
    extrapolateRight: "clamp",
    easing: (t) => 1 - (1 - t) ** 3,
  });
  const titleIn = interpolate(frame, [6, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tracking = interpolate(frame, [6, 40], [22, 11], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - (1 - t) ** 3,
  });
  const rules = interpolate(frame, [20, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subIn = interpolate(frame, [28, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      {/* Hairline bracket that draws out from the centre. */}
      <div
        style={{
          position: "absolute",
          left: x + (w / 2) * (1 - frameDraw),
          top: y,
          width: w * frameDraw,
          height: h,
          border: `1px solid ${alpha("#7f9dc9", 0.14)}`,
          borderRadius: 2,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: y + 34,
          textAlign: "center",
          fontFamily: DISPLAY_FONT,
          fontSize: 27,
          fontWeight: 500,
          letterSpacing: tracking,
          color: PIPE.text,
          opacity: titleIn,
        }}
      >
        AUTONOMOUS PROCESSING MODE
      </div>

      {[-1, 1].map((dir) => (
        <div
          key={dir}
          style={{
            position: "absolute",
            left: 960 + dir * 480 - 60,
            top: y + 50,
            width: 120,
            height: 1,
            background: alpha("#8aa4cc", 0.4),
            transform: `scaleX(${rules})`,
            transformOrigin: dir < 0 ? "right" : "left",
          }}
        />
      ))}

      <div
        style={{
          position: "absolute",
          left: 960 - 50,
          top: y + 74,
          width: 100,
          height: 2,
          background: ACCENT.cyan,
          boxShadow: `0 0 10px ${alpha(ACCENT.cyan, 0.8)}`,
          transform: `scaleX(${rules})`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: y + 100,
          textAlign: "center",
          fontFamily: DISPLAY_FONT,
          fontSize: 11,
          fontWeight: 400,
          letterSpacing: 4.4,
          color: PIPE.textFaint,
          opacity: subIn,
        }}
      >
        7 STAGE ORCHESTRATION · REALTIME · NO OPERATOR
      </div>
    </>
  );
};
