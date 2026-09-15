import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {BorderDefs} from './BorderDefs';
import {geometry, PATH_LENGTH, type Palette} from '../theme';

/**
 * Integral of a speed that ramps linearly from `a` to `b` over `total` frames.
 * Used so the shimmer drifts fastest at the head of the clip and eases off,
 * matching the ~2.8 → ~1.5 px/frame slide measured on the reference.
 */
const drift = (frame: number, total: number, a: number, b: number) =>
  a * frame + ((b - a) * frame * frame) / (2 * total);

type Band = {
  /** Dash pattern, in pathLength units. Must tile evenly into PATH_LENGTH. */
  dash: [number, number];
  /** Speed at the start / end of the clip, in pathLength units per frame. */
  speed: [number, number];
  opacity: number;
  widthScale: number;
  color: 'core' | 'hot';
  blur: 'soft' | 'bloom';
  phase: number;
};

const BANDS: Band[] = [
  {dash: [150, 50], speed: [1.35, 0.82], opacity: 0.34, widthScale: 1, color: 'core', blur: 'soft', phase: 0},
  {dash: [82, 168], speed: [1.05, 0.66], opacity: 0.32, widthScale: 1, color: 'core', blur: 'soft', phase: 410},
  {dash: [30, 220], speed: [1.55, 0.95], opacity: 0.6, widthScale: 0.85, color: 'hot', blur: 'soft', phase: 160},
  {dash: [14, 236], speed: [1.9, 1.15], opacity: 0.75, widthScale: 0.6, color: 'hot', blur: 'bloom', phase: 640},
];

/**
 * The reference-matching variant: a still gold rectangle whose brightness
 * shimmers as several dashed light bands of different lengths creep clockwise
 * around the perimeter at slightly different speeds.
 */
export const ShimmerFrame: React.FC<{palette: Palette; id: string}> = ({palette, id}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  const g = geometry(width, height);

  // Gentle global breathing: the reference dips ~15% around the middle of the
  // clip and comes back brighter at the end.
  const pulse = interpolate(
    frame,
    [0, durationInFrames * 0.45, durationInFrames],
    [1, 0.85, 1.1],
    {extrapolateRight: 'clamp'},
  );

  const common = {
    d: g.d,
    pathLength: PATH_LENGTH,
    fill: 'none' as const,
    strokeLinecap: 'butt' as const,
  };

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}>
        <BorderDefs id={id} g={g} palette={palette} />

        <g mask={`url(#${id}-mask)`} opacity={pulse}>
          {/* Wide, soft halo cast onto the backdrop. */}
          <path
            {...common}
            stroke={palette.bloom}
            strokeWidth={g.stroke * 1.4}
            filter={`url(#${id}-halo)`}
            opacity={0.3}
          />
          {/* The metal itself. */}
          <path {...common} stroke={`url(#${id}-metal)`} strokeWidth={g.stroke} opacity={1} />
          <path {...common} stroke={palette.deep} strokeWidth={g.stroke * 1.7} opacity={0.16} filter={`url(#${id}-soft)`} />

          {/* Travelling light bands, screened over the metal. */}
          <g style={{mixBlendMode: 'screen'}}>
            {BANDS.map((b, i) => {
              const offset = drift(frame, durationInFrames, b.speed[0], b.speed[1]) + b.phase;
              return (
                <path
                  key={i}
                  {...common}
                  stroke={b.color === 'hot' ? palette.hot : palette.core}
                  strokeWidth={g.stroke * b.widthScale}
                  strokeDasharray={`${b.dash[0]} ${b.dash[1]}`}
                  strokeDashoffset={-offset}
                  opacity={b.opacity}
                  filter={`url(#${id}-${b.blur})`}
                />
              );
            })}
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
