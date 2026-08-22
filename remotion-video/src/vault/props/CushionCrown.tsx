// One fat globule on a coral cushion, wearing a crown. The crown's landing is
// the only bounce anywhere in the video.

import React from "react";
import { PALETTE } from "../constants";
import { Glow } from "../Glow";
import { Svg } from "../Svg";

export const CushionCrown: React.FC<{
  /** Vertical offset of the crown above its resting place, in local units. */
  crownDrop: number;
  crownOpacity: number;
  /** Multiplier on the yellow bloom. */
  glow: number;
  /** Idle wobble of the globule, in radians. */
  wobble: number;
}> = ({ crownDrop, crownOpacity, glow, wobble }) => (
  <>
    <Glow color={PALETTE.yellow} size={900 + 500 * glow} opacity={0.24 + 0.3 * glow} y={-40} />
    <Svg half={340}>
      {/* Cushion */}
      <path
        d="M -230 60 Q -250 150 -170 168 L 170 168 Q 250 150 230 60 Q 140 22 0 22 Q -140 22 -230 60 Z"
        fill={PALETTE.coral}
      />
      <circle cx={-206} cy={162} r={20} fill={PALETTE.coral} />
      <circle cx={206} cy={162} r={20} fill={PALETTE.coral} />

      {/* The globule */}
      <ellipse
        cx={0}
        cy={-30 + Math.sin(wobble) * 5}
        rx={132 + Math.sin(wobble) * 4}
        ry={116 - Math.sin(wobble) * 4}
        fill={PALETTE.yellow}
      />

      {/* Crown */}
      <g transform={`translate(0 ${-176 + crownDrop})`} opacity={crownOpacity}>
        <path
          d="M -112 46 L -128 -66 L -64 -12 L 0 -82 L 64 -12 L 128 -66 L 112 46 Z"
          fill={PALETTE.cream}
        />
        <rect x={-118} y={44} width={236} height={30} rx={15} fill={PALETTE.cream} />
        <circle cx={-128} cy={-78} r={15} fill={PALETTE.cream} />
        <circle cx={0} cy={-96} r={16} fill={PALETTE.cream} />
        <circle cx={128} cy={-78} r={15} fill={PALETTE.cream} />
      </g>
    </Svg>
  </>
);
