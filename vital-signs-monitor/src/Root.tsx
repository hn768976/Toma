import React from 'react';
import {Composition} from 'remotion';
import {Monitor, type MonitorProps} from './Monitor';
import {DESIGN_H, DESIGN_W, DURATION_IN_FRAMES, FPS} from './constants';

const UHD = {width: 3840, height: 2160};
const HD = {width: DESIGN_W, height: DESIGN_H};

export const RemotionRoot: React.FC = () => (
  <>
    {/* 4K masters - the deliverable compositions. */}
    <Composition
      id="VitalSigns-Teal-4K"
      component={Monitor}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      {...UHD}
      defaultProps={{variant: 'teal'}}
    />
    <Composition
      id="VitalSigns-Red-4K"
      component={Monitor}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      {...UHD}
      defaultProps={{variant: 'red'}}
    />

    {/* 1080p versions of the same layout. */}
    <Composition
      id="VitalSigns-Teal-1080"
      component={Monitor}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      {...HD}
      defaultProps={{variant: 'teal'}}
    />
    <Composition
      id="VitalSigns-Red-1080"
      component={Monitor}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      {...HD}
      defaultProps={{variant: 'red'}}
    />
  </>
);
