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
      <Composition
        id="ScanHudBrain"
        component={ScanHud}
        durationInFrames={DURATION}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{variant: 'brain' as const}}
      />
      {/* #endregion register:brain */}
    </>
  );
};
