import React from 'react';
import { Composition } from 'remotion';
import { CyberAlert } from './CyberAlert';
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from './engine/cyber-alert.js';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Deliverable: 3840x2160, 60fps, 600 frames = a seamless 10.0s loop. */}
      <Composition
        id="CyberAlert4K"
        component={CyberAlert}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* Same scene, quarter resolution — for fast preview renders. */}
      <Composition
        id="CyberAlert1080"
        component={CyberAlert}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH / 2}
        height={HEIGHT / 2}
      />
    </>
  );
};
