import React from 'react';
import {Composition} from 'remotion';
import {FPS, HEIGHT, LOOP_FRAMES, WIDTH} from './constants';
import {DotMap} from './DotMap';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DotMapNavy"
        component={DotMap}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{variant: 'navy' as const}}
      />
    </>
  );
};
