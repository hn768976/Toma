// The teal thermometer. Its column sinks without warning — the guard does not
// tell you he is doing this.

import React from "react";
import { PALETTE } from "../constants";
import { Glow } from "../Glow";
import { Svg } from "../Svg";

const TOP = -190;
const BOTTOM = 132;

export const Thermometer: React.FC<{
  /** 1 = full column, 0 = fully sunk. */
  level: number;
}> = ({ level }) => {
  const columnTop = TOP + 34 + (BOTTOM - TOP - 60) * (1 - level);

  return (
    <>
      <Glow color={PALETTE.teal} size={620} opacity={0.28} />
      <Svg half={230}>
        {/* Casing */}
        <rect x={-34} y={TOP} width={68} height={BOTTOM - TOP} rx={34} fill={PALETTE.cream} />
        <circle cx={0} cy={BOTTOM + 20} r={62} fill={PALETTE.cream} />
        {/* Bore */}
        <rect x={-18} y={TOP + 18} width={36} height={BOTTOM - TOP - 6} rx={18} fill={PALETTE.navy} />
        {/* Teal column */}
        <circle cx={0} cy={BOTTOM + 20} r={44} fill={PALETTE.teal} />
        <rect x={-18} y={columnTop} width={36} height={BOTTOM + 24 - columnTop} rx={18} fill={PALETTE.teal} />
        {/* Graduations */}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={38} y={TOP + 40 + i * 52} width={26} height={9} rx={4} fill={PALETTE.cream} opacity={0.55} />
        ))}
      </Svg>
    </>
  );
};
