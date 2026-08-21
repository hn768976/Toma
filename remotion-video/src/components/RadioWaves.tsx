import React from "react";
import { HAND_DRAWN_FILTER_ID } from "./HandDrawnFilter";
import { PALETTE } from "../constants";

type RadioWavesProps = {
  center: { x: number; y: number };
  frame: number;
  angleDeg: number; // direction the waves fan out towards
  spanDeg?: number;
  color?: string;
  count?: number;
  period?: number; // frames per pulse loop
  minRadius?: number;
  maxRadius?: number;
  strokeWidth?: number;
  opacity?: number;
};

const arcPath = (
  center: { x: number; y: number },
  radius: number,
  angleDeg: number,
  spanDeg: number,
) => {
  const start = ((angleDeg - spanDeg / 2) * Math.PI) / 180;
  const end = ((angleDeg + spanDeg / 2) * Math.PI) / 180;
  const x1 = center.x + radius * Math.cos(start);
  const y1 = center.y + radius * Math.sin(start);
  const x2 = center.x + radius * Math.cos(end);
  const y2 = center.y + radius * Math.sin(end);
  const largeArc = spanDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
};

// Concentric pulsing arcs representing a Bluetooth radio signal fanning
// out from `center` towards `angleDeg`. Loops forever using `frame`.
export const RadioWaves: React.FC<RadioWavesProps> = ({
  center,
  frame,
  angleDeg,
  spanDeg = 70,
  color = PALETTE.blue,
  count = 3,
  period = 45,
  minRadius = 60,
  maxRadius = 170,
  strokeWidth = 6,
  opacity = 1,
}) => {
  const waves = new Array(count).fill(0).map((_, i) => {
    const phase = i / count;
    const t = (((frame / period + phase) % 1) + 1) % 1;
    const radius = minRadius + t * (maxRadius - minRadius);
    const fade = 1 - t;
    return { radius, fade };
  });

  return (
    <g style={{ filter: `url(#${HAND_DRAWN_FILTER_ID})` }}>
      {waves.map((w, i) => (
        <path
          key={i}
          d={arcPath(center, w.radius, angleDeg, spanDeg)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={w.fade * opacity}
        />
      ))}
    </g>
  );
};
