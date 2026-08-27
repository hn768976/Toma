import React from 'react';
import {Composition} from 'remotion';
import {ScanHud} from './ScanHud';
import {DURATION, FPS, H, W} from './lib/layout';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ScanHudCar"
        component={ScanHud}
        durationInFrames={DURATION}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{variant: 'car' as const}}
      />
      <Composition
        id="LoopCheck"
        component={ScanHud}
        durationInFrames={DURATION + 1}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{variant: 'jet' as const}}
      />
      {/* #region register:jet */}
      <Composition
        id="ScanHudJet"
        component={ScanHud}
        durationInFrames={DURATION}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{variant: 'jet' as const}}
      />
      {/* #endregion register:jet */}
      {/* #region register:brain */}
      {/* #endregion register:brain */}
    </>
  );
};
