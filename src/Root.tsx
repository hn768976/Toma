import React from 'react';
import {Composition} from 'remotion';
import {SecureLock} from './SecureLock';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SecureLockNavy"
        component={SecureLock}
        durationInFrames={960}
        fps={60}
        width={3840}
        height={2160}
        defaultProps={{variant: 'navy' as const}}
      />
      <Composition
        id="SecureLockGreen"
        component={SecureLock}
        durationInFrames={960}
        fps={60}
        width={3840}
        height={2160}
        defaultProps={{variant: 'green' as const}}
      />
    </>
  );
};
