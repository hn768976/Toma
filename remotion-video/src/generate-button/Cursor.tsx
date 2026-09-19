import React from "react";
import { CURSOR_HEIGHT, CURSOR_WIDTH } from "./constants";
import type { Theme } from "./theme";

/**
 * The pointer, traced off the reference: a symmetric arrowhead with a
 * notched tail, tip at the top. Drawn with the tip at the origin so
 * positioning is just "put the tip here".
 */
const HALF = CURSOR_WIDTH / 2;
const NOTCH = CURSOR_HEIGHT * 0.82;
const PATH = `M0 0 L${-HALF} ${CURSOR_HEIGHT} L0 ${NOTCH} L${HALF} ${CURSOR_HEIGHT} Z`;

export const Cursor: React.FC<{
  x: number;
  y: number;
  opacity: number;
  theme: Theme;
}> = ({ x, y, opacity, theme }) => {
  if (opacity <= 0.001) return null;
  return (
    <svg
      style={{
        position: "absolute",
        left: x - HALF,
        top: y,
        width: CURSOR_WIDTH,
        height: CURSOR_HEIGHT * 1.15,
        overflow: "visible",
        opacity,
      }}
      viewBox={`${-HALF} 0 ${CURSOR_WIDTH} ${CURSOR_HEIGHT * 1.15}`}
    >
      <path
        d={PATH}
        fill={theme.cursorFill}
        stroke={theme.cursorStroke}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </svg>
  );
};
