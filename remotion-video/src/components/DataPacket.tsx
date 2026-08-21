import React from "react";
import { HAND_DRAWN_FILTER_ID } from "./HandDrawnFilter";
import { PALETTE } from "../constants";

type Point = { x: number; y: number };

const quadraticPoint = (p0: Point, c: Point, p1: Point, t: number): Point => {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
  };
};

export const curveControlPoint = (
  from: Point,
  to: Point,
  curveAmount: number,
): Point => {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return { x: mid.x + nx * curveAmount, y: mid.y + ny * curveAmount };
};

type DataPacketsProps = {
  from: Point;
  to: Point;
  curveAmount?: number;
  frame: number;
  period?: number;
  count?: number;
  size?: number;
  color?: string;
  progress?: number; // 0-1, overall reveal so packets fade in with the scene
};

// A little stream of hand-drawn "data packet" chips flowing from one
// device to another along the same curve used by <Arrow />.
export const DataPackets: React.FC<DataPacketsProps> = ({
  from,
  to,
  curveAmount = 40,
  frame,
  period = 55,
  count = 3,
  size = 26,
  color = PALETTE.orange,
  progress = 1,
}) => {
  const control = curveControlPoint(from, to, curveAmount);

  const packets = new Array(count).fill(0).map((_, i) => {
    const phase = i / count;
    const t = (((frame / period + phase) % 1) + 1) % 1;
    const pos = quadraticPoint(from, control, to, t);
    const fade = Math.sin(Math.PI * t); // fade in, fade out at both ends
    return { pos, fade, t };
  });

  return (
    <g style={{ filter: `url(#${HAND_DRAWN_FILTER_ID})` }} opacity={progress}>
      {packets.map((p, i) => (
        <g key={i} transform={`translate(${p.pos.x} ${p.pos.y})`} opacity={p.fade}>
          <rect
            x={-size / 2}
            y={-size / 2}
            width={size}
            height={size}
            rx={6}
            fill={PALETTE.white}
            stroke={color}
            strokeWidth={4}
          />
          <circle cx={-size / 5} cy={0} r={2.6} fill={color} />
          <circle cx={0} cy={0} r={2.6} fill={color} />
          <circle cx={size / 5} cy={0} r={2.6} fill={color} />
        </g>
      ))}
    </g>
  );
};
