import React from 'react';
import {Composition} from 'remotion';
import {AgenticHud} from './AgenticHud';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AgenticDialViolet"
        component={AgenticHud}
        durationInFrames={490}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{variant: 'violet'}}
      />
    </>
  );
};
