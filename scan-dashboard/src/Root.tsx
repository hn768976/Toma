import React from 'react';
import { Composition } from 'remotion';
import './fonts';
import { DURATION, FPS, HEIGHT, WIDTH } from './constants';
import { ScanDashboard } from './ScanDashboard';
import { CYAN, VIOLET } from './theme';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-ScanDashboardViolet"
      component={ScanDashboard}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ theme: VIOLET }}
    />
    <Composition
      id="V2-ScanDashboardCyan"
      component={ScanDashboard}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ theme: CYAN }}
    />
  </>
);
