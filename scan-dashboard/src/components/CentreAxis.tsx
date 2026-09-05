import React from 'react';
import { PLANE_W, SPHERE_CX, SPHERE_CY, SPHERE_R, SW } from '../constants';
import { loopSin } from '../motion';
import type { Theme } from '../theme';

const pad = (v: number, n: number) => String(Math.abs(Math.round(v))).padStart(n, '0');

/** The horizontal rule that runs through the sphere's equator, edge to edge. */
export const CentreAxis: React.FC<{ theme: Theme; frame: number }> = ({ theme, frame }) => {
  const gap = SPHERE_R * 1.42;
  const left = SPHERE_CX - gap;
  const right = SPHERE_CX + gap;
  const ticks: React.ReactNode[] = [];
  for (let x = 60; x < PLANE_W; x += 60) {
    if (x > left - 240 && x < right + 240) continue;
    ticks.push(
      <path
        key={x}
        d={`M${x} ${SPHERE_CY - (x % 300 === 0 ? 16 : 8)}v${(x % 300 === 0 ? 32 : 16)}`}
        stroke={theme.grid}
        strokeWidth={SW.hair}
        opacity={0.42}
      />,
    );
  }
  const a = 3400 + 240 * loopSin(frame, 1);
  const b = 5100 + 300 * loopSin(frame, 2, Math.PI / 4);
  return (
    <g>
      <path d={`M0 ${SPHERE_CY}H${left - 200}`} stroke={theme.frameDim} strokeWidth={SW.hair} opacity={0.5} />
      <path d={`M${right + 200} ${SPHERE_CY}H${PLANE_W}`} stroke={theme.frameDim} strokeWidth={SW.hair} opacity={0.5} />
      {ticks}
      {/* Kept inside the clear gap between the columns and the sphere's ring. */}
      <text x={left - 150} y={SPHERE_CY - 16} fontSize={28} fill={theme.text} opacity={0.66} letterSpacing={2}>
        {pad(a, 4)}
      </text>
      <text x={right + 150} y={SPHERE_CY - 16} fontSize={28} fill={theme.text} textAnchor="end" opacity={0.66} letterSpacing={2}>
        {pad(b, 4)}
      </text>
    </g>
  );
};
