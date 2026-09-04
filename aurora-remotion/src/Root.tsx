import React from 'react';
import {Composition} from 'remotion';
import {AuroraScene} from './aurora/AuroraScene';

// 3840x2160 so the same source renders at 4K. Preview renders use
// `--scale=0.5` for a 1920x1080 file — sizes are all fractions of the frame,
// so the two match exactly.
const COMMON = {
  width: 3840,
  height: 2160,
  fps: 30,
  durationInFrames: 900, // 30s, seamless loop
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-AuroraGreenRidge"
        component={AuroraScene}
        {...COMMON}
        defaultProps={{variant: 'green-ridge' as const}}
      />
      <Composition
        id="V2-AuroraVioletStorm"
        component={AuroraScene}
        {...COMMON}
        defaultProps={{variant: 'violet-storm' as const}}
      />
      <Composition
        id="V3-AuroraSkyPlate"
        component={AuroraScene}
        {...COMMON}
        defaultProps={{variant: 'sky-plate' as const}}
      />
    </>
  );
};
