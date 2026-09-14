import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Colourway} from './colourways';
import {GLYPH_ROWS, textCells} from './glyphs';
import {hash} from './hash';
import {TIMING} from './timing';

/**
 * Two thin concentric circles at frame centre with a counter beneath, up at the
 * open and gone by ~frame 70.
 */

type Props = {
  readonly colourway: Colourway;
};

/** Draws a string out of 5x7 cells, centred on (cx, cy). */
const CellText: React.FC<{
  readonly text: string;
  readonly cx: number;
  readonly cy: number;
  readonly cell: number;
  readonly tracking?: number;
  readonly colour: string;
}> = ({text, cx, cy, cell, tracking = 2, colour}) => {
  const {cells, cols} = textCells(text, tracking);
  const x0 = cx - (cols * cell) / 2;
  const y0 = cy - (GLYPH_ROWS * cell) / 2;
  return (
    <g fill={colour}>
      {cells.map((c, i) => (
        <rect key={i} x={x0 + c.x * cell} y={y0 + c.y * cell} width={cell} height={cell} />
      ))}
    </g>
  );
};

export const LoadingRing: React.FC<Props> = ({colourway}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const opacity = interpolate(
    frame,
    [TIMING.loadingIn, TIMING.loadingIn + 8, TIMING.loadingHold, TIMING.loadingOut],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  if (opacity <= 0) return null;

  const cx = width / 2;
  const cy = height / 2;
  const radius = height * 0.16;
  const stroke = Math.max(1, height * 0.0012);
  // Sized so LOADING sits comfortably inside the ring with the counter beneath.
  const cell = height * 0.0044;

  const count = Math.round(
    interpolate(frame, [TIMING.loadingIn, TIMING.loadingHold], [0, 99], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  // A one-frame horizontal kick, so the ring sits inside the glitch too.
  const kick = hash(frame, 71) > 0.88 ? (hash(frame, 72) - 0.5) * width * 0.012 : 0;
  const ringSlip = (hash(Math.floor(frame / 3), 73) - 0.5) * width * 0.004;

  return (
    <AbsoluteFill style={{opacity}}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <g transform={`translate(${kick} 0)`} stroke={colourway.ui} fill="none">
          <circle cx={cx} cy={cy} r={radius} strokeWidth={stroke} opacity={0.85} />
          <circle cx={cx} cy={cy} r={radius * 0.945} strokeWidth={stroke} opacity={0.45} />
          {/* A third ring, slightly off-register, so the UI sits inside the
              glitch rather than on top of it. */}
          <circle
            cx={cx + ringSlip}
            cy={cy}
            r={radius * 0.9}
            strokeWidth={stroke}
            opacity={0.22}
          />
        </g>
        <g transform={`translate(${kick} 0)`}>
          <CellText
            text="LOADING"
            cx={cx}
            cy={cy - radius * 0.06}
            cell={cell}
            tracking={3}
            colour={colourway.ui}
          />
          <CellText
            text={String(count).padStart(2, '0')}
            cx={cx}
            cy={cy + radius * 0.34}
            cell={cell * 1.25}
            tracking={2}
            colour={colourway.ui}
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
