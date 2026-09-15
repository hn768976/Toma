import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import type {Palette} from '../theme';

/**
 * A tileable fractal-noise texture, built once as a data URI so the browser can
 * cache the decoded bitmap instead of re-running feTurbulence on every frame.
 */
const noiseTile = (): string => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">' +
    '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" stitchTiles="stitch"/></filter>' +
    '<rect width="240" height="240" filter="url(#n)"/></svg>';
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};

const NOISE = noiseTile();

/**
 * Black backdrop with a barely-there coloured glow in the middle, a woven
 * texture over it and a vignette on top — the same recipe as the reference,
 * where the centre pixel sits around rgb(6,12,13) and the corners are pure 0.
 */
export const Backdrop: React.FC<{palette: Palette}> = ({palette}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  const scale = width / 1920;

  // Slow breathing of the centre glow so the backdrop never looks frozen.
  const breathe = interpolate(
    Math.sin((frame / durationInFrames) * Math.PI * 2 - Math.PI / 2),
    [-1, 1],
    [0.82, 1.12],
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#000000'}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 58% 62% at 50% 50%, ${palette.glow} 0%, rgba(0,0,0,0) 72%)`,
          opacity: breathe,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: NOISE,
          backgroundSize: `${Math.round(240 * scale)}px ${Math.round(240 * scale)}px`,
          backgroundColor: palette.grain,
          backgroundBlendMode: 'multiply',
          mixBlendMode: 'overlay',
          opacity: 0.3,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 72% 78% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          width,
          height,
          background:
            'repeating-linear-gradient(118deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 7px)',
          opacity: 0.6,
        }}
      />
    </AbsoluteFill>
  );
};
