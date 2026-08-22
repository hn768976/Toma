// The teal clock above the guard. Its hand starts turning the frame he
// arrives and does not stop for the rest of the video, in any cue.

import React from "react";
import { PALETTE } from "../constants";
import { Glow } from "../Glow";
import { Svg } from "../Svg";

const RADIUS = 78;

export const ClockRing: React.FC<{
  /** Hand angle in degrees; grows without bound. */
  angle: number;
}> = ({ angle }) => (
  <>
    <Glow color={PALETTE.teal} size={330} opacity={0.32} />
    <Svg half={110}>
      <circle cx={0} cy={0} r={RADIUS} fill="none" stroke={PALETTE.teal} strokeWidth={13} />
      {[0, 90, 180, 270].map((tick) => (
        <rect
          key={tick}
          x={-5}
          y={-RADIUS + 4}
          width={10}
          height={16}
          rx={5}
          fill={PALETTE.navy}
          transform={`rotate(${tick})`}
        />
      ))}
      <g transform={`rotate(${angle})`}>
        <rect x={-6} y={-58} width={12} height={62} rx={6} fill={PALETTE.teal} />
      </g>
      <g transform={`rotate(${angle / 12})`}>
        <rect x={-7} y={-38} width={14} height={44} rx={7} fill={PALETTE.teal} />
      </g>
      <circle cx={0} cy={0} r={11} fill={PALETTE.teal} />
    </Svg>
  </>
);
