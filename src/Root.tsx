import React from 'react';
import { Composition } from 'remotion';
import { DataCurve } from './DataCurve';
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from './config';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DataCurveUK"
        component={DataCurve}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: 'uk' as const }}
      />
      <Composition
        id="DataCurveUSA"
        component={DataCurve}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: 'usa' as const }}
      />
      <Composition
        id="DataCurveChina"
        component={DataCurve}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: 'china' as const }}
      />
      <Composition
        id="DataCurveSpain"
        component={DataCurve}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: 'spain' as const }}
      />
      <Composition
        id="DataCurveFrance"
        component={DataCurve}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: 'france' as const }}
      />
      <Composition
        id="DataCurveGermany"
        component={DataCurve}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: 'germany' as const }}
      />
    </>
  );
};
