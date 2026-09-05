import React from 'react';

/**
 * Fine grain, tiled from a handful of pre-built noise tiles.
 *
 * The tiles are serialised once at module scope — no random numbers at render
 * time — and cycled by frame so the grain moves without ever repeating visibly.
 */
const tile = (seed: number) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">` +
    `<filter id="n" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" stitchTiles="stitch" seed="${seed}"/>` +
    `<feColorMatrix type="saturate" values="0"/>` +
    `</filter><rect width="200" height="200" filter="url(#n)"/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};

const TILES = [3, 11, 19, 27, 41, 57].map(tile);

export const Grain: React.FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      backgroundImage: TILES[frame % TILES.length],
      backgroundSize: '400px 400px',
      mixBlendMode: 'overlay',
      opacity: 0.05,
      pointerEvents: 'none',
    }}
  />
);
