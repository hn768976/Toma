import React from 'react';
import { SW } from '../constants';
import { PANELS } from '../layout';
import { loopSin } from '../motion';
import type { Theme } from '../theme';

/** The two small panels of text-shaped marks along the lower edge. */
export const Panels: React.FC<{ theme: Theme; frame: number }> = ({ theme, frame }) => (
  <g>
    {PANELS.map((p, i) => {
      const rowH = (p.h - 76) / p.lines.length;
      const sweep = (0.5 + 0.5 * loopSin(frame, 1, i * Math.PI)) * p.lines.length;
      return (
        <g key={i} transform={`translate(${p.x} ${p.y})`}>
          <rect
            width={p.w}
            height={p.h}
            fill="none"
            stroke={theme.frameDim}
            strokeWidth={SW.frame}
            opacity={0.5}
          />
          <path d={`M0 54H${p.w}`} stroke={theme.frameDim} strokeWidth={SW.hair} opacity={0.42} />
          <text x={16} y={38} fontSize={28} fill={theme.text} opacity={0.6} letterSpacing={2}>
            {p.label}
          </text>
          {p.lines.map((marks, r) => {
            const active = Math.floor(sweep) === r;
            return (
              <g key={r}>
                {Array.from({ length: marks.length / 2 }, (_, k) => (
                  <rect
                    key={k}
                    x={16 + marks[k * 2] * (p.w - 32)}
                    y={70 + r * rowH}
                    width={marks[k * 2 + 1] * (p.w - 32)}
                    height={14}
                    fill={active ? theme.text : theme.textDim}
                    opacity={active ? 0.6 : 0.3}
                  />
                ))}
              </g>
            );
          })}
        </g>
      );
    })}
  </g>
);
