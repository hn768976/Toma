import React from 'react';
import { useVideoConfig } from 'remotion';
import { Layer, DrawFn } from './Layer';

type Props = {
  /** Draw only the *brightest cores* here, never the whole image. */
  draw: DrawFn;
  /** Blur radius as a fraction of the frame height. */
  radius?: number;
  strength?: number;
  res?: number;
};

/**
 * A selective bloom pass.
 *
 * These are already bright compositions, so bloom is applied to a separate
 * layer holding only the hottest cores — and that layer is composited *below*
 * the silhouette. Blooming the whole frame, or blooming above the figure, would
 * wash out the crisp black edge against the light, and that edge is the entire
 * read of every one of these shots.
 */
export const Bloom: React.FC<Props> = ({ draw, radius = 0.035, strength = 0.75, res = 1 / 6 }) => {
  const { height } = useVideoConfig();
  // The filter is applied to the element, so its radius is in composition
  // pixels and stays correct at any render scale.
  return (
    <Layer
      res={res}
      draw={draw}
      blend="screen"
      opacity={strength}
      filter={`blur(${(radius * height).toFixed(1)}px)`}
    />
  );
};
