import React from 'react';
import {Composition} from 'remotion';
import {Scene} from './Scene';
import {DARK_BLUE, VIOLET, type Theme} from './theme';
import {DURATION_IN_FRAMES, FPS} from './config';

/**
 * The 4K compositions are the masters. The 1080p entries are the same scene at
 * a smaller pixel grid — not a downscale of a 4K render — because the whole
 * scene is vector and resolution independent.
 */
const VARIANTS: {suffix: string; theme: Theme}[] = [
  {suffix: 'Violet', theme: VIOLET},
  {suffix: 'DarkBlue', theme: DARK_BLUE},
];

const SIZES: {suffix: string; width: number; height: number}[] = [
  {suffix: '4K', width: 3840, height: 2160},
  {suffix: '1080', width: 1920, height: 1080},
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {VARIANTS.flatMap((v) =>
        SIZES.map((s) => (
          <Composition
            key={`Globe${v.suffix}${s.suffix}`}
            id={`Globe${v.suffix}${s.suffix}`}
            component={Scene}
            durationInFrames={DURATION_IN_FRAMES}
            fps={FPS}
            width={s.width}
            height={s.height}
            defaultProps={{theme: v.theme}}
          />
        )),
      )}
    </>
  );
};
