import React from 'react';
import { Composition } from 'remotion';
import { Hilltop } from './compositions/Hilltop';
import { Orb } from './compositions/Orb';
import { Chakra } from './compositions/Chakra';
import { Vortex } from './compositions/Vortex';

/**
 * All four compositions are defined at 3840x2160 so they can be rendered at 4K.
 * Every size in the project is a fraction of the frame, so a `--scale=0.5`
 * preview is a pixel-exact half of the 4K render.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-MeditationHilltop"
      component={Hilltop}
      durationInFrames={600}
      fps={30}
      width={3840}
      height={2160}
    />
    <Composition
      id="V2-MeditationOrb"
      component={Orb}
      durationInFrames={600}
      fps={30}
      width={3840}
      height={2160}
    />
    <Composition
      id="V3-MeditationChakra"
      component={Chakra}
      durationInFrames={720}
      fps={30}
      width={3840}
      height={2160}
    />
    <Composition
      id="V4-MeditationVortex"
      component={Vortex}
      durationInFrames={600}
      fps={30}
      width={3840}
      height={2160}
    />
  </>
);
