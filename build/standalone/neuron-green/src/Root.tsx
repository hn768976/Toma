import React from 'react';
import {Composition} from 'remotion';
import {NeuronField} from './NeuronField';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NeuronGreen"
      component={NeuronField}
      durationInFrames={375}
      fps={30}
      width={3840}
      height={2160}
    />
  );
};
