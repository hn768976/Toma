import React, { useMemo } from 'react';
import { PLANE_H, PLANE_W, SW } from '../constants';
import type { Theme } from '../theme';

const CELL = 80;
const MAJOR_EVERY = 5;

/** The fine perspective grid the whole dashboard sits on. */
export const Grid: React.FC<{ theme: Theme }> = ({ theme }) => {
  const { minor, major } = useMemo(() => {
    const minorParts: string[] = [];
    const majorParts: string[] = [];
    let i = 0;
    for (let x = 0; x <= PLANE_W; x += CELL, i++) {
      (i % MAJOR_EVERY === 0 ? majorParts : minorParts).push(`M${x} 0V${PLANE_H}`);
    }
    i = 0;
    for (let y = 0; y <= PLANE_H; y += CELL, i++) {
      (i % MAJOR_EVERY === 0 ? majorParts : minorParts).push(`M0 ${y}H${PLANE_W}`);
    }
    return { minor: minorParts.join(''), major: majorParts.join('') };
  }, []);

  return (
    <g>
      <path d={minor} stroke={theme.grid} strokeWidth={SW.gridMinor} opacity={0.34} fill="none" />
      <path d={major} stroke={theme.gridMajor} strokeWidth={SW.gridMajor} opacity={0.5} fill="none" />
    </g>
  );
};
