import React from 'react';
import {AbsoluteFill, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// Fine film grain from a tiled noise plate, re-offset every frame so it moves
// rather than sitting on the image. It lives outside the push-in transform:
// grain is a finishing pass, not part of the map.
export const Grain: React.FC<{opacity: number}> = ({opacity}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  if (opacity <= 0) return null;

  // 2px granules at 4K, so they land on ~1px at a 1080p render.
  const tile = 0.1333 * width;

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile('grain.png')})`,
        backgroundSize: `${tile}px ${tile}px`,
        backgroundPosition: `${random(`gx${frame}`) * tile}px ${
          random(`gy${frame}`) * tile
        }px`,
        mixBlendMode: 'overlay',
        opacity,
      }}
    />
  );
};
