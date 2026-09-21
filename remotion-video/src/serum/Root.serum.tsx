import React from 'react';
import { Composition } from 'remotion';
import { LOOKS } from './looks';
import { SerumComposition } from './SerumComposition';

/** Compositions are defined at 4K; previews render with --scale=0.5. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

export const SerumCompositions: React.FC = () => (
  <>
    {LOOKS.map((look) => (
      <Composition
        key={look.id}
        id={look.id}
        component={SerumComposition}
        durationInFrames={look.durationInFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ lookId: look.id }}
      />
    ))}
  </>
);
