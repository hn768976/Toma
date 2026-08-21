import React from "react";
import { HAND_DRAWN_FILTER_ID } from "./HandDrawnFilter";
import { useDrawOn } from "../hooks/useDrawOn";
import { PALETTE } from "../constants";
import { curveControlPoint } from "./DataPacket";

type Point = { x: number; y: number };

type ArrowProps = {
  from: Point;
  to: Point;
  progress: number; // 0 -> 1, how much of the arrow has been drawn
  color?: string;
  strokeWidth?: number;
  curveAmount?: number; // positive bows up, negative bows down
  dashed?: boolean;
};

// A hand-drawn arrow that "draws itself" from `from` to `to` as
// `progress` advances from 0 to 1. Curves gently and ends in an arrowhead.
export const Arrow: React.FC<ArrowProps> = ({
  from,
  to,
  progress,
  color = PALETTE.ink,
  strokeWidth = 5,
  curveAmount = 40,
  dashed = false,
}) => {
  const { ref, dashProps } = useDrawOn();

  const control = curveControlPoint(from, to, curveAmount);

  const d = `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`;

  // Tangent at the end of the curve, for orienting the arrowhead.
  const tangentAngle =
    (Math.atan2(to.y - control.y, to.x - control.x) * 180) / Math.PI;

  const shown = progress > 0.02;
  const headScale = Math.max(0, Math.min(1, (progress - 0.85) / 0.15));

  const drawn = dashProps(progress);

  return (
    <g style={{ filter: `url(#${HAND_DRAWN_FILTER_ID})` }} opacity={shown ? 1 : 0}>
      <path
        ref={ref}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={
          dashed ? `${drawn.strokeDasharray === 0 ? 0 : 14} 12` : undefined
        }
        style={
          dashed
            ? { opacity: shown ? 1 : 0 }
            : {
                strokeDasharray: drawn.strokeDasharray,
                strokeDashoffset: drawn.strokeDashoffset,
              }
        }
      />
      {headScale > 0 && (
        <g transform={`translate(${to.x} ${to.y}) rotate(${tangentAngle})`}>
          <path
            d={`M 0 0 L -22 -12 L -14 0 L -22 12 Z`}
            fill={color}
            opacity={headScale}
          />
        </g>
      )}
    </g>
  );
};
