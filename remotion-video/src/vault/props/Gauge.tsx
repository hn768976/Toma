// The gauge bolted to the side of the vault. Its needle sweeps E → F. It is
// real, and it is a hormone.

import React from "react";
import { PALETTE } from "../constants";
import { Glow } from "../Glow";
import { Svg } from "../Svg";

const R = 108;

export const Gauge: React.FC<{
  /** 0 = empty, 1 = full. Maps to a -62° → +62° needle sweep. */
  level: number;
  /** Extra glow on top of the resting bloom, 0 → 1. */
  pulse: number;
}> = ({ level, pulse }) => {
  const angle = -62 + 124 * level;

  return (
    <>
      <Glow color={PALETTE.teal} size={430 + 320 * pulse} opacity={0.3 + 0.4 * pulse} />
      <Svg half={165}>
        {/* Bolted mounting plate */}
        <rect x={-138} y={-138} width={276} height={276} rx={34} fill={PALETTE.cream} />
        {[-1, 1].map((sx) =>
          [-1, 1].map((sy) => (
            <circle key={`${sx}${sy}`} cx={sx * 108} cy={sy * 108} r={11} fill={PALETTE.navy} opacity={0.4} />
          )),
        )}

        {/* Dial */}
        <circle cx={0} cy={0} r={R} fill={PALETTE.navy} />
        <circle cx={0} cy={0} r={R} fill="none" stroke={PALETTE.teal} strokeWidth={9} opacity={0.85} />

        {/* E and F ticks */}
        <rect x={-5} y={-R + 8} width={10} height={22} rx={5} fill={PALETTE.teal}
          transform="rotate(-62)" opacity={0.9} />
        <rect x={-5} y={-R + 8} width={10} height={22} rx={5} fill={PALETTE.teal}
          transform="rotate(62)" opacity={0.9} />
        <rect x={-4} y={-R + 10} width={8} height={16} rx={4} fill={PALETTE.teal} opacity={0.5} />

        {/* Needle */}
        <g transform={`rotate(${angle})`}>
          <path d={`M -9 14 L 9 14 L 4 ${-R + 26} L -4 ${-R + 26} Z`} fill={PALETTE.teal} />
        </g>
        <circle cx={0} cy={0} r={16} fill={PALETTE.teal} />

        {/* Pulse ring */}
        {pulse > 0 ? (
          <circle cx={0} cy={0} r={R + 14 + 26 * pulse} fill="none" stroke={PALETTE.teal}
            strokeWidth={10} opacity={0.7 * (1 - pulse)} />
        ) : null}
      </Svg>
    </>
  );
};
