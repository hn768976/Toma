import React from "react";
import { AbsoluteFill } from "remotion";
import { rgba } from "../color";
import { GRID_MAJOR, GRID_MINOR, GRID_OFFSET_Y } from "../constants";
import type { Theme } from "../theme";

/**
 * The grid is CSS gradients rather than SVG lines: at 4K that is ~130 lines of
 * geometry the compositor never has to touch, and a gradient hard-stop lands on
 * an exact pixel boundary where a stroked line would be antialiased.
 *
 * Spacings are rounded to whole pixels and the scroll offset is always a whole
 * number of pixels, so the grid can never shimmer as it moves.
 */
export const Grid: React.FC<{
  theme: Theme;
  scroll: number;
  scale: number;
}> = ({ theme, scroll, scale }) => {
  const minor = Math.round(GRID_MINOR * scale);
  const major = Math.round(GRID_MAJOR * scale);
  // 1 output pixel at 1080p, 2 at 4K: thin enough to stay a hairline, thick
  // enough to survive the downscale without turning into a grey wash.
  const line = Math.max(1, Math.round(scale * 2));

  const minorColor = rgba(theme.gridColor, theme.gridMinorOpacity);
  const majorColor = rgba(theme.gridColor, theme.gridMajorOpacity);

  const lines = (angle: string, color: string, period: number) =>
    `repeating-linear-gradient(${angle}, ${color} 0 ${line}px, transparent ${line}px ${period}px)`;

  const offset = -(scroll % GRID_MAJOR) * scale;
  const offsetY = GRID_OFFSET_Y * scale;

  return (
    <AbsoluteFill
      style={{
        backgroundImage: [
          lines("90deg", majorColor, major),
          lines("180deg", majorColor, major),
          lines("90deg", minorColor, minor),
          lines("180deg", minorColor, minor),
        ].join(", "),
        // Only the vertical lines scroll; the horizontal ones are the voltage
        // axis and stay put, offset so a major division lands on the main
        // sine's zero line.
        backgroundPosition: `${offset}px 0, 0 ${offsetY}px, ${offset}px 0, 0 ${offsetY}px`,
      }}
    />
  );
};
