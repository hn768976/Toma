import React from "react";
import { useCurrentFrame } from "remotion";
import { LOG_LINES } from "../content";
import { useU } from "../layout";
import { MONO } from "../load-fonts";
import type { Theme } from "../theme";

/**
 * Log lines arrive at the bottom and push the stack up. The newest line
 * slides in over a few frames rather than snapping, which is what makes
 * it read as a stream instead of a list.
 */
export const LogStream: React.FC<{ theme: Theme; scale: number }> = ({
  theme,
  scale,
}) => {
  const frame = useCurrentFrame();
  const u = useU();

  const fs = u(scale);
  const lineH = fs * 1.62;

  const shown = LOG_LINES.filter((l) => l.frame <= frame);
  const visible = shown.slice(-18);
  const newest = shown[shown.length - 1];

  // 0 -> 1 over the first 7 frames of the newest line's life.
  const age = newest ? Math.min(1, (frame - newest.frame) / 7) : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: `0 ${fs * 0.7}px ${fs * 0.7}px`,
        fontFamily: MONO,
        fontSize: fs,
        lineHeight: `${lineH}px`,
        color: theme.body,
        transform: `translateY(${(1 - age) * lineH}px)`,
      }}
    >
      {visible.map((l, i) => {
        const isNewest = i === visible.length - 1;
        // Older lines dim out towards the top of the window.
        const fade = Math.min(1, 0.32 + (i / Math.max(1, visible.length - 1)) * 0.68);
        return (
          <div
            key={`${l.frame}-${l.seq}`}
            style={{
              whiteSpace: "nowrap",
              opacity: isNewest ? age * fade : fade,
              color: l.level === "wrn" ? theme.warn : theme.body,
            }}
          >
            <span style={{ color: theme.bodyDim }}>{l.seq} </span>
            <span
              style={{
                color: l.level === "wrn" ? theme.warn : theme.bodyDim,
              }}
            >
              {l.level}{" "}
            </span>
            <span style={{ color: isNewest ? theme.bright : undefined }}>
              {l.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};
