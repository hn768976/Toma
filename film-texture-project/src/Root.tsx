import React from 'react';
import {Composition} from 'remotion';
import {DURATION, FPS, HEIGHT, VERSIONS, WIDTH} from './config';
import {FilmTexture} from './FilmTexture';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {Object.keys(VERSIONS).map((id) => (
        <Composition
          key={id}
          id={id}
          component={FilmTexture}
          durationInFrames={DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{version: id as keyof typeof VERSIONS}}
        />
      ))}
    </>
  );
};
