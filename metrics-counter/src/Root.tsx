import React from 'react';
import {Composition} from 'remotion';
import {MetricsCounter} from './MetricsCounter';
import {DARK, LIGHT} from './theme';

/**
 * Defined at 4K. The 1080p deliverables are the same composition rendered with
 * --scale=0.5; every dimension in the design is a fraction of the composition
 * size, so the two are identical apart from resolution.
 */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION = 600;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-MetricsCounterLight"
        component={MetricsCounter}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{theme: LIGHT}}
      />
      <Composition
        id="V2-MetricsCounterDark"
        component={MetricsCounter}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{theme: DARK}}
      />
    </>
  );
};
