import React from "react";
import { CX, CY, RING_R } from "./network";
import type { Theme } from "./theme";

const TICKS = 132;

/**
 * The central ring: an outer tick ring with a travelling pulse running round
 * it, and a counter-rotating dashed inner circle. The interior stays empty.
 */
export const Ring: React.FC<{ theme: Theme; t: number; ids: string }> = ({ theme, t, ids }) => {
  // Whole numbers of turns across the loop, in opposite directions.
  const headFrac = (t * 2) % 1;
  const innerRot = -3 * 360 * t;

  const ticks = [];
  for (let i = 0; i < TICKS; i++) {
    const f = i / TICKS;
    const behind = (headFrac - f + 1) % 1;
    const lit = Math.exp(-behind * 15);
    const a = f * Math.PI * 2 - Math.PI / 2;
    const long = i % 11 === 0;
    const r0 = RING_R + 11;
    const r1 = RING_R + (long ? 48 : 30);
    ticks.push(
      <line
        key={i}
        x1={CX + Math.cos(a) * r0}
        y1={CY + Math.sin(a) * r0}
        x2={CX + Math.cos(a) * r1}
        y2={CY + Math.sin(a) * r1}
        stroke={theme.ring}
        strokeWidth={long ? 4.6 : 3.2}
        opacity={0.32 + 0.68 * lit}
      />,
    );
  }

  return (
    <g>
      <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke={theme.ring} strokeWidth={4.6} opacity={0.98} />
      <circle cx={CX} cy={CY} r={RING_R - 7} fill="none" stroke={theme.ringSoft} strokeWidth={2} opacity={0.6} />
      {ticks}
      <g transform={`rotate(${innerRot} ${CX} ${CY})`}>
        <circle
          cx={CX}
          cy={CY}
          r={RING_R * 0.86}
          fill="none"
          stroke={theme.ring}
          strokeWidth={3.2}
          strokeDasharray="26 16"
          opacity={0.82}
        />
        <circle
          cx={CX}
          cy={CY}
          r={RING_R * 0.79}
          fill="none"
          stroke={theme.ring}
          strokeWidth={1.4}
          strokeDasharray="6 22"
          opacity={0.42}
        />
      </g>
      <circle
        cx={CX}
        cy={CY}
        r={RING_R * 1.14}
        fill="none"
        stroke={theme.ring}
        strokeWidth={1.4}
        strokeDasharray="120 58"
        opacity={0.28}
        transform={`rotate(${-innerRot / 3} ${CX} ${CY})`}
      />
    </g>
  );
};
