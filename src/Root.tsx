import React from 'react';
import {Composition} from 'remotion';
import {ContourCrowd} from './ContourCrowd';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ContourCrowd"
      component={ContourCrowd}
      durationInFrames={480}
      fps={30}
      width={3840}
      height={2160}
      defaultProps={{variant: 'violet' as const}}
    />
  );
};
