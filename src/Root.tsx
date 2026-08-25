import React from 'react';
import { Composition } from 'remotion';
import { FPS, HEIGHT, LOOP, WIDTH } from './board/constants';
import { TickerBoard } from './TickerBoard';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TickerBoard"
      component={TickerBoard}
      durationInFrames={LOOP}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
