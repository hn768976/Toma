import React from "react";
import { AbsoluteFill } from "remotion";

/**
 * Fine film grain, which is here to do a job rather than for texture:
 * the large, very soft gradients in the background band badly once H.264
 * quantises them, and a little noise dithers those steps away. Check the
 * encoded file, not the studio preview -- the preview never shows it.
 *
 * The noise is one small feTurbulence tile rendered once into a data URI
 * and repeated, not a filter re-evaluated over the whole 4K frame every
 * frame. It is animated by sliding the tile, and because the tile is 120
 * CSS px and the composition is 600 frames -- a whole multiple of 120 --
 * any integer step per frame returns to its starting offset on the loop.
 */
const TILE = 120;

const noiseTile = (seed: number, frequency: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'>` +
      `<filter id='n' x='0' y='0' width='100%' height='100%'>` +
      `<feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='3' seed='${seed}' stitchTiles='stitch'/>` +
      `<feColorMatrix type='saturate' values='0'/>` +
      `</filter><rect width='${TILE}' height='${TILE}' filter='url(#n)'/></svg>`,
  )}")`;

const LAYERS = [
  { image: noiseTile(11, 0.85), stepX: 7, stepY: 11, opacity: 0.62 },
  { image: noiseTile(29, 0.65), stepX: -13, stepY: 5, opacity: 0.38 },
];

export const Grain: React.FC<{ frame: number; opacity: number }> = ({ frame, opacity }) => (
  <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
    {LAYERS.map((layer, i) => (
      <AbsoluteFill
        key={i}
        style={{
          backgroundImage: layer.image,
          backgroundRepeat: "repeat",
          backgroundSize: `${TILE}px ${TILE}px`,
          backgroundPosition: `${((frame * layer.stepX) % TILE) + TILE}px ${
            ((frame * layer.stepY) % TILE) + TILE
          }px`,
          opacity: layer.opacity,
        }}
      />
    ))}
  </AbsoluteFill>
);
