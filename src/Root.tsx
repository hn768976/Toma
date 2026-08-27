import React from 'react';
import {Composition} from 'remotion';
import {AgentIcons} from './AgentIcons';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AgentIconsLight"
        component={AgentIcons}
        durationInFrames={300}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{variant: 'light' as const}}
      />
      <Composition
        id="AgentIconsDark"
        component={AgentIcons}
        durationInFrames={300}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{variant: 'dark' as const}}
      />
    </>
  );
};
