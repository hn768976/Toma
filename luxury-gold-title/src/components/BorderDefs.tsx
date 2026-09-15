import React from 'react';
import type {Geometry, Palette} from '../theme';

/**
 * Shared <defs> for a border layer: the metal gradient across the stroke, the
 * blur filters used for the bloom, and the mask that dissolves the line as it
 * approaches the top-right and bottom-left corners (the reference frame is only
 * "closed" along the top-left → bottom-right diagonal).
 */
export const BorderDefs: React.FC<{
  id: string;
  g: Geometry;
  palette: Palette;
}> = ({id, g, palette}) => {
  return (
    <defs>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stopColor={palette.hot} />
        <stop offset="22%" stopColor={palette.core} />
        <stop offset="52%" stopColor={palette.deep} />
        <stop offset="76%" stopColor={palette.core} />
        <stop offset="100%" stopColor={palette.hot} />
      </linearGradient>

      <radialGradient id={`${id}-cornerfade`}>
        <stop offset="0%" stopColor="#000000" stopOpacity="1" />
        <stop offset="55%" stopColor="#000000" stopOpacity="1" />
        <stop offset="72%" stopColor="#000000" stopOpacity="0.88" />
        <stop offset="85%" stopColor="#000000" stopOpacity="0.5" />
        <stop offset="94%" stopColor="#000000" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0" />
      </radialGradient>

      <mask id={`${id}-mask`} maskUnits="userSpaceOnUse">
        <rect x="0" y="0" width="100%" height="100%" fill="#ffffff" />
        <circle cx={g.x + g.w} cy={g.y} r={g.fade} fill={`url(#${id}-cornerfade)`} />
        <circle cx={g.x} cy={g.y + g.h} r={g.fade} fill={`url(#${id}-cornerfade)`} />
      </mask>

      <filter id={`${id}-soft`} x="-20%" y="-30%" width="140%" height="160%">
        <feGaussianBlur stdDeviation={g.stroke * 0.7} />
      </filter>
      <filter id={`${id}-bloom`} x="-25%" y="-40%" width="150%" height="180%">
        <feGaussianBlur stdDeviation={g.stroke * 2.4} />
      </filter>
      <filter id={`${id}-halo`} x="-35%" y="-55%" width="170%" height="210%">
        <feGaussianBlur stdDeviation={g.stroke * 6} />
      </filter>
    </defs>
  );
};
