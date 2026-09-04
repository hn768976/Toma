import React from "react";
import { ALERTS } from "./alerts";
import { FRAMES_PER_ROW } from "./constants";
import { MONO_FAMILY } from "./font";
import type { Layout } from "./useLayout";

/**
 * Alerts live in the same coordinate space as the field, so once written they
 * scroll with it. Each entrance is a hard cut: one frame absent, the next
 * frame fully drawn.
 */
export const AlertLayer: React.FC<{ frame: number; layout: Layout }> = ({
  frame,
  layout,
}) => {
  const scrollPx = (frame * layout.rowH) / FRAMES_PER_ROW;
  const glowSize = Math.round(layout.fontSize * 0.9);
  const padV = Math.round(layout.rowH * 0.1);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: -scrollPx,
        right: 0,
        fontFamily: `"${MONO_FAMILY}", monospace`,
        fontSize: layout.fontSize,
        lineHeight: `${layout.rowH}px`,
        whiteSpace: "pre",
      }}
    >
      {ALERTS.map((alert, i) => {
        if (frame < alert.appearsAt) {
          return null;
        }
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: alert.row * layout.rowH,
              left: alert.col * layout.charW,
              padding: `${padV}px ${layout.charW}px`,
              backgroundColor: alert.bg,
              color: alert.fg,
              boxShadow: `0 0 ${glowSize}px ${alert.bg}66`,
            }}
          >
            {alert.text}
          </div>
        );
      })}
    </div>
  );
};
