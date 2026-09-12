import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { BASE_HEIGHT, BASE_WIDTH } from "./constants";
import { FONT_SANS, type Theme } from "./theme";

/**
 * Locks children to the 1920x1080 design grid and scales that grid to
 * whatever the composition's real resolution is. At 4K the browser rasterises
 * the scaled DOM at full device resolution, so text and 1px rules stay sharp
 * instead of being upsampled.
 */
export const Stage: React.FC<{ theme: Theme; children: React.ReactNode }> = ({
  theme,
  children,
}) => {
  const { width, height } = useVideoConfig();
  const scale = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT);

  return (
    <AbsoluteFill
      style={{
        background: theme.bgGradient,
        fontFamily: FONT_SANS,
        color: theme.text,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
