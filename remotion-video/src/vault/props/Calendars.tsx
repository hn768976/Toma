// A row of calendar squares flicking over about six times a second: the years
// the guard keeps working after you have stopped paying attention.

import React from "react";
import { PALETTE } from "../constants";
import { Svg } from "../Svg";

const COUNT = 7;
const SIZE = 96;
const GAP = 26;

export const Calendars: React.FC<{
  /** Per-square reveal, 0 → 1. */
  squareScales: number[];
  /** Which square is lit right now. */
  active: number;
  /** Advances with the flicking, drives the marks inside each square. */
  tick: number;
}> = ({ squareScales, active, tick }) => {
  const totalW = COUNT * SIZE + (COUNT - 1) * GAP;

  return (
    <Svg half={totalW / 2 + 20}>
      {new Array(COUNT).fill(0).map((_, i) => {
        const s = squareScales[i] ?? 0;
        if (s <= 0) return null;
        const lit = i === active;
        const x = -totalW / 2 + i * (SIZE + GAP) + SIZE / 2;
        const marks = ((tick + i * 3) % 4) + 1;
        return (
          <g key={i} transform={`translate(${x} 0) scale(${s})`} opacity={lit ? 1 : 0.72}>
            <rect x={-SIZE / 2} y={-SIZE / 2} width={SIZE} height={SIZE} rx={16} fill={PALETTE.cream} />
            {/* Header bar */}
            <rect x={-SIZE / 2} y={-SIZE / 2} width={SIZE} height={22} rx={11} fill={PALETTE.navy} opacity={0.5} />
            {/* Days ticked off */}
            {new Array(marks).fill(0).map((__, m) => (
              <rect
                key={m}
                x={-SIZE / 2 + 14 + (m % 2) * 34}
                y={-SIZE / 2 + 36 + Math.floor(m / 2) * 26}
                width={26}
                height={14}
                rx={7}
                fill={PALETTE.navy}
                opacity={0.45}
              />
            ))}
          </g>
        );
      })}
    </Svg>
  );
};
