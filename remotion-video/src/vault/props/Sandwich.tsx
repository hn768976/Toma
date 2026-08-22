// A cheese sandwich: two flat cream slices with a yellow slice between them,
// the whole stack tilted so it does not read as a machined block. No
// outlines — the yellow does all the separating.

import React from "react";
import { PALETTE } from "../constants";
import { Glow } from "../Glow";
import { Svg } from "../Svg";

export const Sandwich: React.FC<{ glow: number }> = ({ glow }) => (
  <>
    <Glow color={PALETTE.yellow} size={430 + 330 * glow} opacity={0.2 + 0.24 * glow} />
    <Svg half={200}>
      <g transform="rotate(-7)">
        {/* Bottom slice */}
        <rect x={-150} y={30} width={300} height={58} rx={20} fill={PALETTE.cream} />
        {/* Cheese, sticking out past the bread on both sides */}
        <rect x={-174} y={-6} width={348} height={40} rx={10} fill={PALETTE.yellow} />
        <circle cx={-66} cy={14} r={8} fill={PALETTE.navy} opacity={0.2} />
        <circle cx={44} cy={12} r={6} fill={PALETTE.navy} opacity={0.2} />
        {/* Top slice */}
        <rect x={-150} y={-62} width={300} height={58} rx={20} fill={PALETTE.cream} />
      </g>
    </Svg>
  </>
);
