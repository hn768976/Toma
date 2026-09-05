import React from 'react';
import { SW } from '../constants';
import { DECOR } from '../layout';
import { loopSin } from '../motion';
import type { Theme } from '../theme';

/** Corner brackets and stray tick rows that fill the gaps between modules. */
export const Decor: React.FC<{ theme: Theme; frame: number }> = ({ theme, frame }) => (
  <g>
    {DECOR.brackets.map((b, i) => (
      <path
        key={`b${i}`}
        d={`M${-b.s} ${-b.s * 0.28}V${-b.s}H${-b.s * 0.28}`}
        transform={`translate(${b.x} ${b.y}) rotate(${b.rot})`}
        fill="none"
        stroke={theme.frameDim}
        strokeWidth={SW.frame}
        opacity={0.5}
      />
    ))}
    {DECOR.ticks.map((t, i) => {
      const step = t.w / (t.n - 1);
      const head = (0.5 + 0.5 * loopSin(frame, 1 + (i % 3), t.phase)) * (t.n - 1);
      return (
        <g key={`t${i}`} transform={`translate(${t.x} ${t.y})${t.vertical ? ' rotate(90)' : ''}`}>
          {Array.from({ length: t.n }, (_, k) => (
            <path
              key={k}
              d={`M${k * step} 0v${k % 4 === 0 ? 22 : 13}`}
              stroke={k <= head ? theme.text : theme.grid}
              strokeWidth={SW.hair}
              opacity={k <= head ? 0.42 : 0.3}
            />
          ))}
        </g>
      );
    })}
  </g>
);
