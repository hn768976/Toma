import React from "react";
import { HAND_DRAWN_FILTER_ID } from "./HandDrawnFilter";
import { PALETTE } from "../constants";

type FrequencyHopProps = {
  x: number;
  y: number;
  frame: number;
  width?: number;
  channelCount?: number;
  period?: number; // frames between hops
  color?: string;
  progress?: number; // 0-1 reveal
};

// A tiny diagram illustrating Bluetooth's frequency-hopping spread
// spectrum: a row of channel ticks with a dot hopping between them.
const HOP_SEQUENCE = [3, 11, 7, 14, 1, 9, 5, 13, 2, 10, 6, 15, 0, 12, 4, 8];

export const FrequencyHop: React.FC<FrequencyHopProps> = ({
  x,
  y,
  frame,
  width = 480,
  channelCount = 16,
  period = 7,
  color = PALETTE.orange,
  progress = 1,
}) => {
  const hopIndex = Math.floor(frame / period) % HOP_SEQUENCE.length;
  const activeChannel = HOP_SEQUENCE[hopIndex] % channelCount;
  const spacing = width / (channelCount - 1);

  return (
    <g
      transform={`translate(${x - width / 2} ${y})`}
      opacity={progress}
      style={{ filter: `url(#${HAND_DRAWN_FILTER_ID})` }}
    >
      <path
        d={`M 0 0 L ${width} 0`}
        stroke={PALETTE.ink}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.5}
      />
      {new Array(channelCount).fill(0).map((_, i) => (
        <line
          key={i}
          x1={i * spacing}
          y1={-10}
          x2={i * spacing}
          y2={10}
          stroke={PALETTE.ink}
          strokeWidth={i === activeChannel ? 5 : 3}
          opacity={i === activeChannel ? 1 : 0.35}
        />
      ))}
      <circle
        cx={activeChannel * spacing}
        cy={-34}
        r={12}
        fill={color}
        stroke={PALETTE.ink}
        strokeWidth={2.5}
      />
      <line
        x1={activeChannel * spacing}
        y1={-22}
        x2={activeChannel * spacing}
        y2={-10}
        stroke={color}
        strokeWidth={3}
      />
    </g>
  );
};
