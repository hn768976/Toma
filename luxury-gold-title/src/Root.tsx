import React from 'react';
import {Composition} from 'remotion';
import {GoldBorder} from './compositions/GoldBorder';
import {CyanBorder} from './compositions/CyanBorder';

/**
 * Matches the reference clip exactly: 30 fps, 301 frames (10.033 s).
 * The reference is 898x506; these compositions are the same 16:9 frame at
 * 4K UHD and Full HD.
 */
export const FPS = 30;
export const DURATION_IN_FRAMES = 301;

const UHD = {width: 3840, height: 2160};
const HD = {width: 1920, height: 1080};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GoldBorder-4K"
        component={GoldBorder}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        {...UHD}
      />
      <Composition
        id="GoldBorder-1080p"
        component={GoldBorder}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        {...HD}
      />
      <Composition
        id="CyanBorder-4K"
        component={CyanBorder}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        {...UHD}
      />
      <Composition
        id="CyanBorder-1080p"
        component={CyanBorder}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        {...HD}
      />
    </>
  );
};
