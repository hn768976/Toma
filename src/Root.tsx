import React from 'react';
import {Composition} from 'remotion';
import {CodeTunnelTitle} from './CodeTunnelTitle';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CodeTunnelTitle"
        component={CodeTunnelTitle}
        durationInFrames={600}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{title: 'WEB 3.0'}}
      />
      <Composition
        id="CodeTunnelTitleV2"
        component={CodeTunnelTitle}
        durationInFrames={600}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{title: 'NEURAL NETWORK', variant: 'electric' as const}}
      />
    </>
  );
};
