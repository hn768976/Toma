import React from 'react';
import {Composition} from 'remotion';
import {BlackHole} from './BlackHole';
import {DURATION_IN_FRAMES, FPS, HEIGHT, type PaletteId, WIDTH} from './look';

const versions: {id: string; palette: PaletteId}[] = [
  {id: 'V1-BlackHoleMono', palette: 'mono'},
  {id: 'V2-BlackHoleGold', palette: 'gold'},
  {id: 'V3-BlackHoleBlue', palette: 'blue'},
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {versions.map(({id, palette}) => (
        <Composition
          key={id}
          id={id}
          component={BlackHole}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{palette}}
        />
      ))}
    </>
  );
};
