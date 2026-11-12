import React from 'react';
import { Composition } from 'remotion';
import { SeaAbcPilot } from './SeaAbcPilot';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SeaAbcPilot"
      component={SeaAbcPilot}
      durationInFrames={450}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
