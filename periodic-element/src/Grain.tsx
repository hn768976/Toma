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

/**
 * Grain feature size, not grain amount. At baseFrequency 0.8 the features are
 * about one composition pixel across — which is half a pixel once a preview is
 * rendered at --scale=0.5, so the downscale averages the grain away and H.264
 * quantises whatever survives out of the flat dark areas. Measured on an
 * encoded file that left the dark surround with 8 luma levels across the
 * frame. At 0.32 the features are around three composition pixels, so they
 * survive both the downscale and the encoder.
 */
const BASE_FREQUENCY = 0.32;

const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${BASE_FREQUENCY}" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="${TILE}" height="${TILE}" filter="url(#n)"/></svg>`;

const NOISE_URL = `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`;

// One offset per frame of the loop, so the grain is periodic like everything
// else and never repeats visibly within a single frame pair.
const rng = makeRandom("grain");
const OFFSETS: [number, number][] = Array.from(
  { length: DURATION_IN_FRAMES },
  () => [Math.floor(rng() * TILE), Math.floor(rng() * TILE)],
);

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.055 }) => {
  const frame = useCurrentFrame();
  const [x, y] = OFFSETS[frame % DURATION_IN_FRAMES];

  // Two passes, because one blend mode cannot cover the whole range.
  //
  // `overlay` dithers midtones well but collapses toward zero as the backdrop
  // approaches black — which is precisely where these two compositions spend
  // most of their area, and where H.264 bands. Measured on an encoded V1
  // file, the dark surround held only 8 distinct luma levels across a 1920px
  // row, in flat runs up to 512px wide.
  //
  // The `screen` pass adds a small amount of light that does not vanish in
  // the shadows, so the near-black gradient gets dithered too. It lifts the
  // black floor by a level or two, which is a fair price for losing the
  // banding. The two passes use different offsets so their noise does not
  // correlate into a stronger pattern.
  const [x2, y2] = OFFSETS[(frame + 97) % DURATION_IN_FRAMES];

  const layer = (
    px: number,
    py: number,
    blend: "overlay" | "screen",
    alpha: number,
  ): React.CSSProperties => ({
    backgroundImage: NOISE_URL,
    backgroundSize: `${TILE}px ${TILE}px`,
    backgroundPosition: `${px}px ${py}px`,
    opacity: alpha,
    mixBlendMode: blend,
    pointerEvents: "none",
  });

  return (
    <>
      <AbsoluteFill style={layer(x, y, "overlay", opacity)} />
      <AbsoluteFill style={layer(x2, y2, "screen", opacity * 0.85)} />
    </>
  );
};
