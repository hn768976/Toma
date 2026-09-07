import React from 'react';
import {Composition} from 'remotion';
import {DataInterface} from './DataInterface';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DataInterface"
      component={DataInterface}
      durationInFrames={1}
      fps={30}
      width={3840}
      height={2160}
      defaultProps={{
        seed: 'a01',
        palette: 'blue' as const,
        layout: 'leftBinary' as const,
        tilt: 'right' as const,
        density: 'medium' as const,
      }}
    />
  );
};
