import React from 'react';
import {Composition} from 'remotion';
import {CryptoTerminal} from './CryptoTerminal';
import {DURATION, FPS, HEIGHT, WIDTH} from './CryptoTerminal/constants';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CryptoTerminal"
        component={CryptoTerminal}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
