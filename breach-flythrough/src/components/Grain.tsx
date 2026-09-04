import React from "react";
import { makeRng } from "../random";

/**
 * Fine film grain.
 *
 * It is here as much for the encoder as for the look: the scene is one large,
 * very dark falloff, and H.264 bands those badly. A couple of code values of
 * noise dithers the gradient before it is ever encoded.
 *
 * Six pre-built turbulence tiles are cycled and offset on a 12-frame period,
 * which divides the 360-frame loop exactly, so the grain comes round with
 * everything else.
 */

const TILE = 280;
const TILE_COUNT = 6;
const OFFSET_COUNT = 12;

const noiseTile = (seed: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">` +
      `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves="2" seed="${seed}" stitchTiles="stitch"/>` +
      `<feColorMatrix type="saturate" values="0"/></filter>` +
      `<rect width="100%" height="100%" filter="url(#n)"/></svg>`,
  )}")`;

const TILES = Array.from({ length: TILE_COUNT }, (_, i) => noiseTile(i * 17 + 3));

const offsetRng = makeRng("grain-offsets");
const OFFSETS = Array.from(
  { length: OFFSET_COUNT },
  () => `${offsetRng.int(0, TILE)}px ${offsetRng.int(0, TILE)}px`,
);

export const Grain: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundImage: TILES[frame % TILE_COUNT],
      backgroundPosition: OFFSETS[frame % OFFSET_COUNT],
      backgroundRepeat: "repeat",
      mixBlendMode: "screen",
      opacity,
      pointerEvents: "none",
    }}
  />
);
