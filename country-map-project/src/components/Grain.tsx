import React from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame} from 'remotion';

/**
 * Fine film grain. A small tiled noise texture nudged each frame — cheap, and it
 * keeps large flat areas of water from banding once the clip is compressed.
 */
export const Grain: React.FC<{opacity: number; scale: number}> = ({opacity, scale}) => {
  const frame = useCurrentFrame();
  if (opacity <= 0) return null;
  const tile = 256 * scale;
  const x = ((frame * 37) % 256) * scale;
  const y = ((frame * 61) % 256) * scale;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile('grain.png')})`,
        backgroundRepeat: 'repeat',
        backgroundSize: `${tile}px ${tile}px`,
        backgroundPosition: `${x}px ${y}px`,
        opacity,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }}
    />
  );
};

export const Vignette: React.FC<{opacity: number}> = ({opacity}) => {
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse 72% 72% at 50% 50%, rgba(0,0,0,0) 42%, rgba(0,0,0,1) 100%)',
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};
