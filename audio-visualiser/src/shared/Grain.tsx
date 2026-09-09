import React, {useId} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';

/**
 * Deterministic film grain, used to dither the dark gradients so H.264 does not
 * band them.
 *
 * `feTurbulence` is a pure function of its seed, so this stays reproducible
 * across out-of-order frame rendering — unlike Math.random().
 *
 * `blend` picks how the grain lands:
 *  - "screen" adds a little light everywhere, which is what actually breaks up
 *    banding in a dark falloff. It lifts pure black by a pixel value or two.
 *  - "overlay" only modulates what is already lit, leaving black at exactly
 *    #000000 — which is what V3's screen-blend key needs.
 */
export const Grain: React.FC<{
  opacity: number;
  blend?: 'screen' | 'overlay';
  /** Grain cell size in pixels at 4K. Held constant in apparent size. */
  cell?: number;
}> = ({opacity, blend = 'screen', cell = 2.2}) => {
  const frame = useCurrentFrame();
  const {height} = useVideoConfig();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  // Cycles per pixel, adjusted so the grain looks the same at any render scale.
  const baseFrequency = 1 / (cell * (height / 2160));

  return (
    <svg
      width="100%"
      height="100%"
      style={{
        position: 'absolute',
        inset: 0,
        mixBlendMode: blend,
        opacity,
        pointerEvents: 'none',
      }}
    >
      <filter id={id} x="0%" y="0%" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency={baseFrequency}
          numOctaves={1}
          // Walk the seed per frame so the grain moves instead of sitting still.
          seed={(frame * 7) % 509}
          stitchTiles="stitch"
        />
        {/* Collapse to monochrome luminance noise at full alpha. */}
        <feColorMatrix
          type="matrix"
          values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1"
        />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
};
