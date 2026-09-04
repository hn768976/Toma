import React from 'react';
import { AbsoluteFill } from 'remotion';

type Props = {
  strength?: number;
  /** Where the darkening starts, as a fraction of the corner distance. */
  inner?: number;
};

/** Corner falloff, settling the eye on the centre of frame. */
export const Vignette: React.FC<Props> = ({ strength = 0.55, inner = 0.42 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 72% 78% at 50% 50%, rgba(0,0,0,0) ${
        inner * 100
      }%, rgba(0,0,0,${strength * 0.5}) 76%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);
