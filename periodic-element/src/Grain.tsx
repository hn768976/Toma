import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DURATION_IN_FRAMES } from "./constants";
import { makeRandom } from "./lib/random";

/**
 * Film grain. Both styles sit on a large, very dark gradient, which is exactly
 * what H.264 bands on; a couple of percent of noise dithers the gradient and
 * the banding goes away in the encoded file.
 *
 * The noise is one tileable feTurbulence tile encoded as a data URI, so the
 * browser rasterises it once and repeats it. Only its offset changes per
 * frame, which is what makes the grain move without costing a filter pass.
 */
const TILE = 220;

const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="${TILE}" height="${TILE}" filter="url(#n)"/></svg>`;

const NOISE_URL = `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`;

// One offset per frame of the loop, so the grain is periodic like everything
// else and never repeats visibly within a single frame pair.
const rng = makeRandom("grain");
const OFFSETS: [number, number][] = Array.from(
  { length: DURATION_IN_FRAMES },
  () => [Math.floor(rng() * TILE), Math.floor(rng() * TILE)],
);

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.045 }) => {
  const frame = useCurrentFrame();
  const [x, y] = OFFSETS[frame % DURATION_IN_FRAMES];

  return (
    <AbsoluteFill
      style={{
        backgroundImage: NOISE_URL,
        backgroundSize: `${TILE}px ${TILE}px`,
        backgroundPosition: `${x}px ${y}px`,
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};
