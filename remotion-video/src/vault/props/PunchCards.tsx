// A row of punch-card slots beside the guard. Every one of them is blank:
// he has never once clocked off.

import React from "react";
import { PALETTE } from "../constants";
import { Svg } from "../Svg";

const SLOTS = 5;
const SLOT_W = 74;
const SLOT_H = 104;
const GAP = 22;

export const PunchCards: React.FC<{
  /** Per-slot reveal, 0 → 1. */
  slotScales: number[];
}> = ({ slotScales }) => {
  const totalW = SLOTS * SLOT_W + (SLOTS - 1) * GAP;

  return (
    <Svg half={totalW / 2 + 20}>
      {new Array(SLOTS).fill(0).map((_, i) => {
        const s = slotScales[i] ?? 0;
        if (s <= 0) return null;
        const x = -totalW / 2 + i * (SLOT_W + GAP);
        return (
          <g key={i} transform={`translate(${x + SLOT_W / 2} 0) scale(${s})`} opacity={0.42}>
            <rect x={-SLOT_W / 2} y={-SLOT_H / 2} width={SLOT_W} height={SLOT_H} rx={12} fill={PALETTE.cream} />
            {/* Blank slot: a dim navy cut-out where the punch would be */}
            <rect x={-SLOT_W / 2 + 14} y={-SLOT_H / 2 + 18} width={SLOT_W - 28} height={12} rx={6} fill={PALETTE.navy} opacity={0.35} />
            <rect x={-SLOT_W / 2 + 14} y={-SLOT_H / 2 + 44} width={SLOT_W - 28} height={12} rx={6} fill={PALETTE.navy} opacity={0.35} />
            <rect x={-SLOT_W / 2 + 14} y={-SLOT_H / 2 + 70} width={SLOT_W - 28} height={12} rx={6} fill={PALETTE.navy} opacity={0.35} />
          </g>
        );
      })}
    </Svg>
  );
};
