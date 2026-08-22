// The religious event: sixteen slow-turning rays and a halo ring behind the
// sandwich. The only moment in the video where the yellow is at full bloom.

import React from "react";
import { PALETTE } from "../constants";
import { Glow } from "../Glow";
import { Svg } from "../Svg";

const RAYS = 16;

export const RadialBurst: React.FC<{
  /** 0 → 1 as the burst blooms, back to 0 as it collapses. */
  amount: number;
  /** Ray rotation in degrees. */
  angle: number;
}> = ({ amount, angle }) => {
  if (amount <= 0) return null;
  const inner = 200;
  const length = 60 + 170 * amount;

  return (
    <>
      <Glow color={PALETTE.yellow} size={900 * amount} opacity={0.3 * amount} />
      <Svg half={520}>
        <g transform={`rotate(${angle}) scale(${0.6 + 0.4 * amount})`} opacity={amount}>
          {new Array(RAYS).fill(0).map((_, i) => (
            <path
              key={i}
              d={`M -11 ${-inner} L 11 ${-inner} L 21 ${-inner - length} L -21 ${-inner - length} Z`}
              fill={PALETTE.yellow}
              opacity={i % 2 === 0 ? 0.9 : 0.42}
              transform={`rotate(${(360 / RAYS) * i})`}
            />
          ))}
        </g>
        <circle
          cx={0}
          cy={0}
          r={inner + 28}
          fill="none"
          stroke={PALETTE.yellow}
          strokeWidth={13 * amount}
          opacity={0.8 * amount}
        />
      </Svg>
    </>
  );
};
