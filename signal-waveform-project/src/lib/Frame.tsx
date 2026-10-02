import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { DESIGN_H, DESIGN_W } from "./constants";

/**
 * Root SVG for a look. Width/height come from useVideoConfig(); the viewBox
 * is the 1920x1080 design space, so every coordinate, font size, stroke
 * width and blur radius scales with the real frame size (1 design px at
 * 1080p = 2 px at 4K).
 */
export const Frame: React.FC<{ background: string; children: React.ReactNode }> = ({ background, children }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <svg width={width} height={height} viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`} style={{ display: "block" }}>
        {children}
      </svg>
    </AbsoluteFill>
  );
};
