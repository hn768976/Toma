import React from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

/** Noise texels across the tile. */
const TEXELS = 256;
/** One texel is two composition pixels — i.e. exactly one pixel at 1080p. */
const TILE = (TEXELS * 2) / 2160; // × height

/**
 * Film grain, composited normally rather than with `overlay`.
 *
 * The texture is white-on-transparent for the positive half of the noise and
 * black-on-transparent for the negative half, so the deviation it produces is
 * a * opacity * (1 - base) upwards and a * opacity * base downwards. That keeps
 * the grain roughly constant in absolute terms across the frame — an `overlay`
 * blend collapses to nothing on a near-black field, which is precisely where V2
 * needs grain to stop the gradients banding.
 *
 * A pre-generated tile is used rather than feTurbulence so the cost does not
 * scale with the 4K frame.
 */
export const Grain: React.FC<{opacity: number}> = ({opacity}) => {
  const frame = useCurrentFrame();
  const {height} = useVideoConfig();

  if (opacity <= 0) {
    return null;
  }

  const tile = TILE * height;
  const texel = tile / TEXELS;

  // Jump the tile a whole number of texels every frame, so the grain neither
  // crawls nor sits still, and never lands on a half-texel.
  const jitter = (seed: number) =>
    Math.floor(Math.abs((Math.sin(frame * seed) * 43758.5453) % 1) * TEXELS) * texel;

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile('noise.png')})`,
        backgroundSize: `${tile}px ${tile}px`,
        backgroundPosition: `${jitter(12.9898)}px ${jitter(78.233)}px`,
        backgroundRepeat: 'repeat',
        imageRendering: 'pixelated',
        opacity,
      }}
    />
  );
};
