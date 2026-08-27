import React from 'react';
import {Composition} from 'remotion';
import {ParticleFigure} from './ParticleFigure';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ParticleFigureFront"
        component={ParticleFigure}
        durationInFrames={480}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{variant: 'front' as const}}
      />
      <Composition
        id="ParticleFigureProfile"
        component={ParticleFigure}
        durationInFrames={480}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{variant: 'profile' as const}}
      />
      <Composition
        id="ParticleFigureHands"
        component={ParticleFigure}
        durationInFrames={480}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{variant: 'hands' as const}}
      />
    </>
  );
};
