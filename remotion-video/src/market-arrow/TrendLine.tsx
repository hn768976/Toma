import React from "react";
import { STAGE_HEIGHT, STAGE_WIDTH } from "./constants";
import { RALLY_TREND } from "./series";

// The rally's tick chart, drawn progressively left to right. `head` is
// the 0..1 fraction of the series that has been plotted so far; the
// final segment is interpolated so the leading edge advances smoothly
// between points instead of snapping point to point.
export const TrendLine: React.FC<{
  head: number;
  toScreenX: (worldX: number) => number;
  toScreenIndexY: (index: number) => number;
  strokeWidth: number;
  color: string;
  glowColor: string;
  glowBlur: number;
}> = ({
  head,
  toScreenX,
  toScreenIndexY,
  strokeWidth,
  color,
  glowColor,
  glowBlur,
}) => {
  const exact = head * (RALLY_TREND.length - 1);
  const lastWhole = Math.floor(exact);
  const localT = exact - lastWhole;

  const parts: string[] = [];
  for (let i = 0; i <= lastWhole; i++) {
    const pt = RALLY_TREND[i];
    parts.push(
      `${i === 0 ? "M" : "L"} ${toScreenX(pt.x).toFixed(1)} ${toScreenIndexY(
        pt.index,
      ).toFixed(1)}`,
    );
  }
  if (lastWhole + 1 < RALLY_TREND.length && localT > 0) {
    const a = RALLY_TREND[lastWhole];
    const b = RALLY_TREND[lastWhole + 1];
    parts.push(
      `L ${toScreenX(a.x + (b.x - a.x) * localT).toFixed(1)} ${toScreenIndexY(
        a.index + (b.index - a.index) * localT,
      ).toFixed(1)}`,
    );
  }
  const d = parts.join(" ");

  return (
    <svg
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      <defs>
        <filter id="trend-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={glowBlur} />
        </filter>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={glowColor}
        strokeWidth={strokeWidth * 1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#trend-glow)"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
