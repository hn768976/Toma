import React from 'react';
import { SCAN_PASSES, SPHERE_CX, SPHERE_CY, SPHERE_R, SW } from '../constants';
import { loopRamp } from '../motion';
import type { Theme } from '../theme';

const BAND = 300;
const LINE_GAP = 16;

/**
 * Fine vertical scan lines falling through the sphere: a faint standing set,
 * plus a band that descends through them an integer number of times per loop.
 */
export const ScanBand: React.FC<{ theme: Theme; frame: number; idPrefix: string; bloom?: boolean }> = ({
  theme,
  frame,
  idPrefix,
  bloom = false,
}) => {
  const p = loopRamp(frame, SCAN_PASSES);
  const yStart = SPHERE_CY - SPHERE_R - BAND;
  const yEnd = SPHERE_CY + SPHERE_R;
  const yTop = yStart + p * (yEnd - yStart);

  const x0 = SPHERE_CX - SPHERE_R;
  const x1 = SPHERE_CX + SPHERE_R;
  const lines: string[] = [];
  for (let x = x0; x <= x1; x += LINE_GAP) {
    lines.push(`M${x.toFixed(1)} ${SPHERE_CY - SPHERE_R}V${SPHERE_CY + SPHERE_R}`);
  }
  const d = lines.join('');

  const clipId = `${idPrefix}-scanclip`;
  const maskId = `${idPrefix}-scanmask`;
  const gradId = `${idPrefix}-scangrad`;

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <circle cx={SPHERE_CX} cy={SPHERE_CY} r={SPHERE_R - 2} />
        </clipPath>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={0} y1={yTop} x2={0} y2={yTop + BAND}>
          <stop offset="0" stopColor="#000000" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity={0.45} />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={x0} y={yTop} width={x1 - x0} height={BAND}>
          <rect x={x0} y={yTop} width={x1 - x0} height={BAND} fill={`url(#${gradId})`} />
        </mask>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {!bloom ? (
          <path d={d} stroke={theme.wire} strokeWidth={SW.hair} opacity={0.1} fill="none" />
        ) : null}
        <g mask={`url(#${maskId})`}>
          <path d={d} stroke={theme.accent} strokeWidth={SW.hair * 1.2} opacity={bloom ? 0.9 : 0.6} fill="none" />
        </g>
        <path
          d={`M${x0} ${yTop + BAND}H${x1}`}
          stroke={theme.accent}
          strokeWidth={SW.frame}
          opacity={bloom ? 1 : 0.75}
          fill="none"
        />
      </g>
    </>
  );
};
