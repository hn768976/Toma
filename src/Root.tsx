import React from 'react';
import {Composition} from 'remotion';
import {CryptoTerminal} from './CryptoTerminal';
import {DURATION, FPS, HEIGHT, WIDTH} from './CryptoTerminal/constants';
import {DARK, LIGHT} from './CryptoTerminal/theme';

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
        defaultProps={{theme: LIGHT}}
      />
      {/*
        The dark cut. Same scene, same seeded series, same loop — but the
        right-hand third is quiet: no candles bleeding across the sidebar and
        no oversized numerals sliding down the far edge.
      */}
      <Composition
        id="CryptoTerminalDark"
        component={CryptoTerminal}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{theme: DARK}}
      />
    </>
  );
};
