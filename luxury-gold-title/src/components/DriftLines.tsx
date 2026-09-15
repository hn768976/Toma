import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {geometry, type Palette} from '../theme';

type Line = {
  /** Vertical position as a fraction of height. */
  y: number;
  /** Laps across the frame over the full clip; negative travels leftwards. */
  laps: number;
  length: number;
  opacity: number;
  thickness: number;
};

const LINES: Line[] = [
  {y: 0.28, laps: 1, length: 0.34, opacity: 0.36, thickness: 1.4},
  {y: 0.44, laps: -1, length: 0.22, opacity: 0.24, thickness: 1},
  {y: 0.63, laps: 1, length: 0.28, opacity: 0.28, thickness: 1.1},
  {y: 0.78, laps: -2, length: 0.16, opacity: 0.2, thickness: 1},
];

/**
 * Slim horizontal light streaks drifting behind the border. They loop exactly
 * over the clip length, and sit inside the border rectangle only.
 */
export const DriftLines: React.FC<{palette: Palette; id: string}> = ({palette, id}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  const scale = width / 1920;
  const t = frame / durationInFrames;
  const g = geometry(width, height);

  return (
    <AbsoluteFill style={{mixBlendMode: 'screen'}}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}>
        <defs>
          <clipPath id={`${id}-inner`}>
            <rect x={g.x + g.stroke} y={g.y + g.stroke} width={g.w - g.stroke * 2} height={g.h - g.stroke * 2} />
          </clipPath>
          <linearGradient id={`${id}-streak`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={palette.core} stopOpacity="0" />
            <stop offset="42%" stopColor={palette.hot} stopOpacity="0.9" />
            <stop offset="58%" stopColor={palette.hot} stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.core} stopOpacity="0" />
          </linearGradient>
          <filter id={`${id}-streakblur`} x="-10%" y="-400%" width="120%" height="900%">
            <feGaussianBlur stdDeviation={1.6 * scale} />
          </filter>
        </defs>
        <g clipPath={`url(#${id}-inner)`}>
          {LINES.map((l, i) => {
          const len = l.length * width;
          // Travel the full width plus one line length on each side, so the
          // streak is always fully off-screen at the moment it wraps.
          const span = width + len * 2;
          const u = (t * Math.abs(l.laps) + i * 0.37) % 1;
          const x = l.laps > 0 ? -len + u * span : width + len - u * span;
          return (
            <rect
              key={i}
              x={x}
              y={l.y * height}
              width={len}
              height={l.thickness * scale}
              fill={`url(#${id}-streak)`}
              opacity={l.opacity}
              filter={`url(#${id}-streakblur)`}
            />
          );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
