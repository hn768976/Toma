import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {BorderDefs} from './BorderDefs';
import {geometry, PATH_LENGTH, pointAt, type Palette} from '../theme';

/** Number of tail segments drawn behind each runner head. */
const TAIL_SEGMENTS = 18;
/** Arc length of a runner's tail, in pathLength units. */
const TAIL_LENGTH = 210;
/** Laps completed over the full clip. Integer, so the motion loops seamlessly. */
const LAPS = 2;

/**
 * The second variant: the same luxury backdrop and rectangle, rendered in dark
 * cyan, with a bright line running clockwise around the border. Two runners sit
 * half a lap apart so the frame always reads as "alive" on both diagonals.
 */
export const RunnerFrame: React.FC<{palette: Palette; id: string}> = ({palette, id}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  const g = geometry(width, height);

  const head = (frame / durationInFrames) * LAPS * PATH_LENGTH;

  const pulse = interpolate(
    frame,
    [0, durationInFrames * 0.5, durationInFrames],
    [1, 0.92, 1.06],
    {extrapolateRight: 'clamp'},
  );

  const common = {
    d: g.d,
    pathLength: PATH_LENGTH,
    fill: 'none' as const,
    strokeLinecap: 'butt' as const,
  };

  /** One runner: a stack of short dashes whose opacity decays behind the head. */
  const runner = (offsetLap: number, key: string) => {
    const pos = head + offsetLap;
    const seg = TAIL_LENGTH / TAIL_SEGMENTS;
    const tip = pointAt(g, pos);
    return (
      <g key={key}>
        {new Array(TAIL_SEGMENTS).fill(0).map((_, i) => {
          // i = 0 is the head, i = TAIL_SEGMENTS - 1 is the faintest tail piece.
          const t = i / (TAIL_SEGMENTS - 1);
          const start = pos - (i + 1) * seg;
          const alpha = Math.pow(1 - t, 1.45);
          return (
            <path
              key={i}
              {...common}
              stroke={i < 2 ? palette.hot : palette.core}
              strokeWidth={g.stroke * (1.25 - t * 0.45)}
              strokeDasharray={`${seg + 0.6} ${PATH_LENGTH - seg - 0.6}`}
              strokeDashoffset={-start}
              opacity={alpha}
              filter={i < 3 ? `url(#${id}-soft)` : undefined}
            />
          );
        })}
        {/* Wide glow dragged along with the head. */}
        <path
          {...common}
          stroke={palette.bloom}
          strokeWidth={g.stroke * 2.4}
          strokeDasharray={`${TAIL_LENGTH * 0.5} ${PATH_LENGTH - TAIL_LENGTH * 0.5}`}
          strokeDashoffset={-(pos - TAIL_LENGTH * 0.5)}
          opacity={0.55}
          filter={`url(#${id}-bloom)`}
        />
        <circle cx={tip.x} cy={tip.y} r={g.stroke * 4.2} fill={palette.bloom} opacity={0.4} filter={`url(#${id}-bloom)`} />
        <circle cx={tip.x} cy={tip.y} r={g.stroke * 0.85} fill={palette.hot} opacity={0.9} filter={`url(#${id}-soft)`} />
      </g>
    );
  };

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}>
        <BorderDefs id={id} g={g} palette={palette} />

        <g opacity={pulse}>
          {/* Static rail: dimmed toward the TR / BL corners, as in the reference. */}
          <g mask={`url(#${id}-mask)`}>
            <path
              {...common}
              stroke={palette.bloom}
              strokeWidth={g.stroke * 1.4}
              filter={`url(#${id}-halo)`}
              opacity={0.3}
            />
            <path {...common} stroke={`url(#${id}-metal)`} strokeWidth={g.stroke} opacity={0.78} />
          </g>
          {/* Faint continuous rail so the runner never travels over bare black. */}
          <path {...common} stroke={palette.deep} strokeWidth={g.stroke * 0.7} opacity={0.22} />

          <g style={{mixBlendMode: 'screen'}}>
            {runner(0, 'a')}
            {runner(PATH_LENGTH / 2, 'b')}
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
