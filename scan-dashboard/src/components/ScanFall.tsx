import React from 'react';
import { SPHERE_CX, SPHERE_R, SW } from '../constants';
import { STREAKS, STREAK_BOTTOM, STREAK_TOP } from '../layout';
import { loopRamp } from '../motion';
import type { Theme } from '../theme';

/**
 * The curtain of fine vertical lines that hangs above the sphere and falls
 * into it. A standing set of hairlines gives the curtain its shape; bright
 * segments slide down it, each on its own integer number of passes per loop.
 */
export const ScanFall: React.FC<{ theme: Theme; frame: number; idPrefix: string; bloom?: boolean }> = ({
  theme,
  frame,
  idPrefix,
  bloom = false,
}) => {
  const clipId = `${idPrefix}-fallclip`;
  const fadeId = `${idPrefix}-fallfade`;
  const x0 = SPHERE_CX - SPHERE_R * 1.1;
  const w = SPHERE_R * 2.2;
  const h = STREAK_BOTTOM - STREAK_TOP;

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={x0} y={STREAK_TOP} width={w} height={h} />
        </clipPath>
        <linearGradient id={fadeId} gradientUnits="userSpaceOnUse" x1={0} y1={STREAK_TOP} x2={0} y2={STREAK_BOTTOM}>
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.12} />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity={0.55} />
          <stop offset="1" stopColor="#ffffff" stopOpacity={1} />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {!bloom ? (
          <path
            d={STREAKS.map((s) => `M${s.x.toFixed(1)} ${STREAK_TOP}V${STREAK_BOTTOM}`).join('')}
            stroke={theme.wire}
            strokeWidth={SW.hair * 0.8}
            opacity={0.07}
            fill="none"
          />
        ) : null}
        <g stroke={theme.wire} strokeWidth={SW.hair} fill="none">
          {STREAKS.map((s, i) => {
            const p = loopRamp(frame, s.cycles, s.phase);
            const top = STREAK_TOP - s.len + p * (STREAK_BOTTOM - STREAK_TOP + s.len);
            return (
              <path
                key={i}
                d={`M${s.x.toFixed(1)} ${top.toFixed(1)}v${s.len.toFixed(0)}`}
                opacity={bloom ? s.opacity * 0.7 : s.opacity}
              />
            );
          })}
        </g>
      </g>
    </>
  );
};
