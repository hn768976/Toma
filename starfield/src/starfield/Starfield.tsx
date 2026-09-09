import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {z} from 'zod';
import {cameraAt} from './camera';
import {DURATION} from './constants';
import {Grade} from './Grade';
import {Nebula} from './Nebula';
import {PALETTES} from './palettes';
import {StarCanvas} from './StarCanvas';

export const starfieldSchema = z.object({
  version: z.enum(['v1-violet-teal', 'v2-amber-cyan']),
  seed: z.number().int().optional(),
});

export type StarfieldProps = z.infer<typeof starfieldSchema>;

export const Starfield: React.FC<StarfieldProps> = ({version, seed}) => {
  const palette = PALETTES[version];
  const s = seed ?? palette.seed;
  const frame = useCurrentFrame();
  const {rollRad, zoom} = cameraAt((frame % DURATION) / DURATION);
  const rollDeg = (rollRad * 180) / Math.PI;

  return (
    <AbsoluteFill style={{backgroundColor: '#000000'}}>
      {/* Base + nebula ride the camera. The star canvas applies the identical
          transform internally, so it is never resampled. */}
      <AbsoluteFill
        style={{
          transform: `rotate(${rollDeg}deg) scale(${zoom})`,
          transformOrigin: '50% 50%',
        }}
      >
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 52% 52% at 50% 46%, ${palette.baseCenter} 0%, ${palette.baseEdge} 72%)`,
          }}
        />
        <Nebula palette={palette} seed={s} />
      </AbsoluteFill>

      <StarCanvas palette={palette} seed={s} />

      <Grade seed={s} />
    </AbsoluteFill>
  );
};
