import React from 'react';
import {Composition} from 'remotion';
import {V1CircularNeon} from './v1/V1CircularNeon';
import {V2WaveformGrid} from './v2/V2WaveformGrid';
import {V3MinimalWhite} from './v3/V3MinimalWhite';

/**
 * Compositions are defined at 3840x2160 so they can be rendered at 4K later.
 * Every size in the project is a fraction of the frame height, so rendering at
 * --scale=0.5 for a 1080p preview changes nothing but the pixel count.
 */
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-CircularNeon"
      component={V1CircularNeon}
      durationInFrames={300}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    <Composition
      id="V2-WaveformGrid"
      component={V2WaveformGrid}
      durationInFrames={300}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/* 450 frames, and deliberately not a loop: the progress bar runs from
        empty to full, which cannot loop without a visible jump. */}
    <Composition
      id="V3-MinimalWhite"
      component={V3MinimalWhite}
      durationInFrames={450}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);
