import React, {useMemo} from 'react';
import {mulberry32} from './random';
import {sampleRamp, type Theme} from './theme';
import {DESIGN_HEIGHT, DESIGN_WIDTH} from './config';

type Run = {
  x: number;
  y: number;
  text: string;
  size: number;
  /** Parallax tier: 0 = far/small/dim, 1 = near/large/bright. */
  tier: number;
  speed: number;
  phase: number;
  baseOpacity: number;
  color: string;
};

const RUN_COUNT = 760;

const buildRuns = (theme: Theme): Run[] => {
  const rand = mulberry32(0x5eed1234);
  const runs: Run[] = [];

  for (let i = 0; i < RUN_COUNT; i++) {
    const x = rand() * (DESIGN_WIDTH + 300) - 150;
    const y = rand() * (DESIGN_HEIGHT + 400) - 200;

    const len = 1 + Math.floor(rand() * rand() * 5.4);
    let text = '';
    for (let c = 0; c < len; c++) text += rand() < 0.5 ? '0' : '1';

    const tier = rand();
    const size = 24 + tier * tier * 52;

    runs.push({
      x,
      y,
      text,
      size,
      tier,
      // Nearer runs drift faster — cheap parallax.
      speed: (8 + tier * 26) * (rand() < 0.12 ? -0.5 : 1),
      phase: rand() * Math.PI * 2,
      baseOpacity: 0.16 + tier * 0.7,
      // Tint follows horizontal position, so the frame reads cyan on the left
      // and hot magenta on the right like the reference. A small slice stays
      // near-white to keep the field from looking uniformly tinted.
      color:
        rand() < 0.12
          ? theme.digitHighlight
          : sampleRamp(theme.digitRamp, x / DESIGN_WIDTH + (rand() - 0.5) * 0.16),
    });
  }
  return runs;
};

type Props = {
  theme: Theme;
  /** Seconds elapsed. */
  time: number;
};

/**
 * The scrolling field of binary digits behind the globe. Runs are short groups
 * of 1-6 characters rather than a rigid grid, which is what gives the reference
 * its irregular, data-stream texture.
 */
export const BinaryField: React.FC<Props> = ({theme, time}) => {
  const runs = useMemo(() => buildRuns(theme), [theme]);
  const span = DESIGN_HEIGHT + 400;

  return (
    <g>
      {runs.map((r, i) => {
        // Wrap vertically so the field loops seamlessly.
        const y = (((r.y + r.speed * time) % span) + span) % span - 200;
        // Slow, offset flicker per run.
        const flicker = 0.72 + 0.28 * Math.sin(time * (0.7 + r.tier) + r.phase);
        return (
          <text
            key={i}
            x={r.x}
            y={y}
            fontSize={r.size}
            fontFamily="GlobeMono, 'DejaVu Sans Mono', ui-monospace, monospace"
            letterSpacing={r.size * 0.22}
            fill={r.color}
            opacity={r.baseOpacity * flicker}
          >
            {r.text}
          </text>
        );
      })}
    </g>
  );
};
