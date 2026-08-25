import React from 'react';
import {Composition} from 'remotion';
import {MeteorShower} from './MeteorShower';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MeteorShower"
      component={MeteorShower}
      durationInFrames={1020}
      fps={60}
      width={3840}
      height={2160}
    />
  );
};
